import type { Prisma, ReviewStatus } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { buildMeta, getPagination } from '../utils/pagination';

const REVIEWABLE_ORDER_STATUSES = ['DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'] as const;

export async function recalculateRating(productId: string, db: Tx | typeof prisma = prisma) {
  const agg = await db.review.aggregate({ where: { productId, status: 'APPROVED' }, _avg: { rating: true }, _count: { _all: true } });
  await db.product.update({ where: { id: productId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  title?: string;
  body: string;
  imageUrl?: string;
  imagePublicId?: string;
  orderItemId?: string;
}

/**
 * Reviews linked to a delivered order item of the reviewer are marked "Verified Purchase" and published
 * immediately. Other reviews are held for moderation. One review per order item; one unverified review
 * per product per customer.
 */
export async function createReview(userId: string, input: CreateReviewInput) {
  const product = await prisma.product.findFirst({ where: { id: input.productId, deletedAt: null } });
  if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

  let orderItemId: string | null = null;
  if (input.orderItemId) {
    const item = await prisma.orderItem.findFirst({
      where: { id: input.orderItemId, productId: input.productId, order: { userId, status: { in: [...REVIEWABLE_ORDER_STATUSES] } } },
      include: { review: true },
    });
    if (!item) throw AppError.badRequest('You can review this item once it has been delivered', 'REVIEW_NOT_ELIGIBLE');
    if (item.review) throw AppError.conflict('You have already reviewed this purchase', 'DUPLICATE_REVIEW');
    orderItemId = item.id;
  } else {
    const item = await prisma.orderItem.findFirst({
      where: { productId: input.productId, review: null, order: { userId, status: { in: [...REVIEWABLE_ORDER_STATUSES] } } },
      orderBy: { order: { deliveredAt: 'desc' } },
    });
    orderItemId = item?.id ?? null;
  }

  if (!orderItemId) {
    const existing = await prisma.review.findFirst({ where: { userId, productId: input.productId } });
    if (existing) throw AppError.conflict('You have already reviewed this product', 'DUPLICATE_REVIEW');
  }

  const verified = orderItemId !== null;
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        productId: input.productId,
        userId,
        orderItemId,
        rating: input.rating,
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        imagePublicId: input.imagePublicId,
        isVerifiedPurchase: verified,
        status: verified ? 'APPROVED' : 'PENDING',
      },
    });
    if (verified) await recalculateRating(input.productId, tx);
    return review;
  });
}

export async function listProductReviews(slug: string, page = 1, limit = 10, sort: 'recent' | 'highest' | 'lowest' = 'recent') {
  const product = await prisma.product.findFirst({ where: { slug, deletedAt: null }, select: { id: true, ratingAvg: true, ratingCount: true } });
  if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  const p = getPagination(page, limit, 50);
  const where: Prisma.ReviewWhereInput = { productId: product.id, status: 'APPROVED' };
  const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
    sort === 'highest' ? [{ rating: 'desc' }, { createdAt: 'desc' }] : sort === 'lowest' ? [{ rating: 'asc' }, { createdAt: 'desc' }] : [{ createdAt: 'desc' }];
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy,
      skip: p.skip,
      take: p.take,
      select: { id: true, rating: true, title: true, body: true, imageUrl: true, isVerifiedPurchase: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.review.count({ where }),
  ]);
  return {
    // Only first name + initial is shown publicly.
    items: items.map(({ user, ...r }) => ({ ...r, author: shortName(user.name) })),
    meta: buildMeta(p.page, p.limit, total),
    summary: { ratingAvg: Math.round(product.ratingAvg * 10) / 10, ratingCount: product.ratingCount },
  };
}

function shortName(name: string) {
  const [first, last] = name.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : (first ?? 'Customer');
}

/** Latest approved reviews for the homepage testimonials strip. */
export async function featuredReviews(limit = 6) {
  const rows = await prisma.review.findMany({
    where: { status: 'APPROVED', rating: { gte: 4 }, product: { isActive: true, deletedAt: null } },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
    select: { id: true, rating: true, title: true, body: true, isVerifiedPurchase: true, createdAt: true, user: { select: { name: true } }, product: { select: { name: true, slug: true, category: { select: { slug: true } } } } },
  });
  return rows.map(({ user, ...r }) => ({ ...r, author: shortName(user.name) }));
}

export async function myReviews(userId: string) {
  return prisma.review.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { name: true, slug: true, category: { select: { slug: true } } } } },
  });
}

// ───────────────────────────── Admin ─────────────────────────────

export async function adminListReviews(status: ReviewStatus | undefined, page = 1, limit = 20) {
  const p = getPagination(page, limit, 100);
  const where: Prisma.ReviewWhereInput = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: p.skip,
      take: p.take,
      include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } },
    }),
    prisma.review.count({ where }),
  ]);
  return { items, meta: buildMeta(p.page, p.limit, total) };
}

export async function setReviewStatus(id: string, status: ReviewStatus) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');
  return prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({ where: { id }, data: { status } });
    await recalculateRating(review.productId, tx);
    return updated;
  });
}

export async function deleteReview(id: string) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw AppError.notFound('Review not found', 'REVIEW_NOT_FOUND');
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });
    await recalculateRating(review.productId, tx);
  });
  return review;
}
