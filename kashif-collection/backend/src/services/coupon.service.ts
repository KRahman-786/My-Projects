import type { Coupon, Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { buildMeta, getPagination } from '../utils/pagination';

export interface CouponLine {
  productId: string;
  categoryId: string;
  /** unitPrice × quantity, paise */
  lineTotal: number;
}

export interface CouponResult {
  coupon: Pick<Coupon, 'id' | 'code' | 'description' | 'type' | 'value'>;
  discount: number;
  /** Discount share per line index (sums to `discount`) */
  allocations: number[];
}

type CouponWithScope = Coupon & { categories: { categoryId: string }[]; products: { productId: string }[] };

export async function findCoupon(code: string, db: Tx | typeof prisma = prisma): Promise<CouponWithScope | null> {
  return db.coupon.findFirst({
    where: { code: code.trim().toUpperCase(), deletedAt: null },
    include: { categories: { select: { categoryId: true } }, products: { select: { productId: true } } },
  });
}

/**
 * Validates a coupon against cart lines and computes the discount. Pure business rules — every
 * failure raises an AppError with a specific errorCode so the UI can explain it.
 */
export async function evaluateCoupon(
  code: string,
  lines: CouponLine[],
  userId: string | undefined,
  db: Tx | typeof prisma = prisma,
  now = new Date(),
): Promise<CouponResult> {
  const coupon = await findCoupon(code, db);
  if (!coupon) throw AppError.notFound('This coupon code is not valid', 'COUPON_NOT_FOUND');
  if (!coupon.isActive) throw AppError.unprocessable('This coupon is no longer active', 'COUPON_INACTIVE');
  if (coupon.startsAt && coupon.startsAt > now) throw AppError.unprocessable('This coupon is not active yet', 'COUPON_NOT_STARTED');
  if (coupon.expiresAt && coupon.expiresAt < now) throw AppError.unprocessable('This coupon has expired', 'COUPON_EXPIRED');
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw AppError.unprocessable('This coupon has reached its usage limit', 'COUPON_USAGE_LIMIT');
  }
  if (userId) {
    const used = await db.couponUsage.count({ where: { couponId: coupon.id, userId } });
    if (used >= coupon.perUserLimit) throw AppError.unprocessable('You have already used this coupon', 'COUPON_USER_LIMIT');
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  if (subtotal < coupon.minCartValue) {
    throw AppError.unprocessable(`Add items worth ₹${((coupon.minCartValue - subtotal) / 100).toFixed(0)} more to use this coupon`, 'COUPON_MIN_CART', {
      minCartValue: coupon.minCartValue,
    });
  }

  const scoped = coupon.categories.length > 0 || coupon.products.length > 0;
  const eligible = lines.map(
    (l) => !scoped || coupon.products.some((p) => p.productId === l.productId) || coupon.categories.some((c) => c.categoryId === l.categoryId),
  );
  const eligibleTotal = lines.reduce((s, l, i) => s + (eligible[i] ? l.lineTotal : 0), 0);
  if (eligibleTotal <= 0) throw AppError.unprocessable('This coupon is not applicable to the items in your cart', 'COUPON_NOT_APPLICABLE');

  let discount = coupon.type === 'PERCENTAGE' ? Math.floor((eligibleTotal * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, eligibleTotal);

  // Allocate proportionally to eligible lines; remainder goes to the largest line so shares sum exactly.
  const allocations = lines.map((l, i) => (eligible[i] ? Math.floor((discount * l.lineTotal) / eligibleTotal) : 0));
  const remainder = discount - allocations.reduce((s, a) => s + a, 0);
  if (remainder > 0) {
    let largest = -1;
    lines.forEach((l, i) => {
      if (eligible[i] && (largest < 0 || l.lineTotal > lines[largest]!.lineTotal)) largest = i;
    });
    allocations[largest]! += remainder;
  }

  return { coupon: { id: coupon.id, code: coupon.code, description: coupon.description, type: coupon.type, value: coupon.value }, discount, allocations };
}

/**
 * Records coupon usage inside the order transaction. An advisory lock per (coupon,user) serialises
 * concurrent checkouts of the same user, and the conditional increment enforces the global limit atomically.
 */
export async function consumeCoupon(tx: Tx, couponId: string, userId: string, orderId: string, discount: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${couponId + ':' + userId}))`;
  const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } });
  const used = await tx.couponUsage.count({ where: { couponId, userId } });
  if (used >= coupon.perUserLimit) throw AppError.unprocessable('You have already used this coupon', 'COUPON_USER_LIMIT');

  const updated = await tx.$executeRaw`
    UPDATE "coupons" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
     WHERE "id" = ${couponId} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
  if (updated === 0) throw AppError.unprocessable('This coupon has reached its usage limit', 'COUPON_USAGE_LIMIT');
  await tx.couponUsage.create({ data: { couponId, userId, orderId, discount } });
}

/** Gives the coupon back when an order is cancelled before fulfilment or payment never completes. */
export async function releaseCoupon(tx: Tx, orderId: string) {
  const usage = await tx.couponUsage.findUnique({ where: { orderId } });
  if (!usage) return;
  await tx.couponUsage.delete({ where: { id: usage.id } });
  await tx.$executeRaw`UPDATE "coupons" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "id" = ${usage.couponId}`;
}

/** Coupons shown on the storefront offers strip (public, active, not exhausted). */
export async function listPublicCoupons() {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }],
    },
    select: { code: true, description: true, type: true, value: true, minCartValue: true, maxDiscount: true, expiresAt: true, usageLimit: true, usedCount: true },
    orderBy: { createdAt: 'asc' },
  });
  return coupons.filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit).map(({ usageLimit: _l, usedCount: _u, ...c }) => c);
}

// ───────────────────────────── Admin ─────────────────────────────

export interface CouponAdminInput {
  code: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minCartValue?: number;
  maxDiscount?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  usageLimit?: number | null;
  perUserLimit?: number;
  isActive?: boolean;
  categoryIds?: string[];
  productIds?: string[];
}

export async function adminListCoupons(page = 1, limit = 50) {
  const { skip, take } = getPagination(page, limit, 100);
  const where: Prisma.CouponWhereInput = { deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { categories: { select: { category: { select: { id: true, name: true } } } }, products: { select: { product: { select: { id: true, name: true } } } } },
    }),
    prisma.coupon.count({ where }),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function createCoupon(input: CouponAdminInput) {
  const { categoryIds, productIds, ...data } = input;
  return prisma.coupon.create({
    data: {
      ...data,
      code: data.code.toUpperCase(),
      categories: categoryIds?.length ? { create: categoryIds.map((categoryId) => ({ categoryId })) } : undefined,
      products: productIds?.length ? { create: productIds.map((productId) => ({ productId })) } : undefined,
    },
  });
}

export async function updateCoupon(id: string, input: Partial<CouponAdminInput>) {
  const existing = await prisma.coupon.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Coupon not found', 'COUPON_NOT_FOUND');
  const { categoryIds, productIds, ...data } = input;
  return prisma.$transaction(async (tx) => {
    if (categoryIds) {
      await tx.couponCategory.deleteMany({ where: { couponId: id } });
      if (categoryIds.length) await tx.couponCategory.createMany({ data: categoryIds.map((categoryId) => ({ couponId: id, categoryId })) });
    }
    if (productIds) {
      await tx.couponProduct.deleteMany({ where: { couponId: id } });
      if (productIds.length) await tx.couponProduct.createMany({ data: productIds.map((productId) => ({ couponId: id, productId })) });
    }
    return tx.coupon.update({ where: { id }, data: { ...data, code: data.code?.toUpperCase() } });
  });
}

export async function deleteCoupon(id: string) {
  const existing = await prisma.coupon.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Coupon not found', 'COUPON_NOT_FOUND');
  await prisma.coupon.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, code: `${existing.code}--DELETED-${Date.now()}` } });
}
