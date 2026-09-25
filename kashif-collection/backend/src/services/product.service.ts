import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { buildMeta, getPagination } from '../utils/pagination';
import { discountPercent } from '../utils/money';
import { slugify } from '../utils/slug';
import type {
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
  VariantInput,
} from '../validators/product.validators';

export const LIVE_PRODUCT: Prisma.ProductWhereInput = { isActive: true, deletedAt: null, category: { isActive: true, deletedAt: null } };
const LIVE_VARIANT: Prisma.ProductVariantWhereInput = { isActive: true, deletedAt: null };

const cardInclude = {
  category: { select: { name: true, slug: true } },
  subcategory: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' }, take: 2, select: { url: true, altText: true } },
  variants: {
    where: LIVE_VARIANT,
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, color: true, colorHex: true, size: true, price: true, mrp: true, inventory: { select: { availableStock: true } } },
  },
} satisfies Prisma.ProductInclude;

type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

/** Public, storefront-safe product card representation. */
export function toCard(p: CardProduct) {
  const available = p.variants.reduce((sum, v) => sum + (v.inventory?.availableStock ?? 0), 0);
  const colors = [...new Map(p.variants.filter((v) => v.color).map((v) => [v.color, { name: v.color!, hex: v.colorHex }])).values()];
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    brand: p.brand,
    category: p.category,
    subcategory: p.subcategory,
    mrp: p.mrp,
    price: p.price,
    discountPercent: p.discountPercent,
    ratingAvg: Math.round(p.ratingAvg * 10) / 10,
    ratingCount: p.ratingCount,
    images: p.images,
    isFeatured: p.isFeatured,
    isBestSeller: p.isBestSeller,
    isNewArrival: p.isNewArrival,
    inStock: available > 0,
    colors,
    variantCount: p.variants.length,
    /** Lets the storefront add single-variant products to the cart straight from a card. */
    defaultVariantId: p.variants.length === 1 ? p.variants[0]!.id : null,
  };
}

function buildWhere(q: ProductListQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [LIVE_PRODUCT];

  if (q.q) {
    const term = q.q;
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    and.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
        { tags: { hasSome: words } },
        { category: { name: { contains: term, mode: 'insensitive' } } },
        { subcategory: { name: { contains: term, mode: 'insensitive' } } },
        { variants: { some: { sku: { contains: term, mode: 'insensitive' } } } },
        // every word appears somewhere in the name (e.g. "red lipstick" → "Velvet Matte Lipstick — Ruby Red")
        { AND: words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })) },
      ],
    });
  }
  if (q.category) and.push({ category: { slug: q.category } });
  if (q.subcategory) and.push({ subcategory: { slug: q.subcategory } });
  if (q.brand?.length) and.push({ brand: { in: q.brand, mode: 'insensitive' } });
  if (q.tags?.length) and.push({ tags: { hasSome: q.tags.map((t) => t.toLowerCase()) } });
  if (q.ids?.length) and.push({ id: { in: q.ids } });
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    and.push({
      price: {
        ...(q.minPrice !== undefined ? { gte: Math.round(q.minPrice * 100) } : {}),
        ...(q.maxPrice !== undefined ? { lte: Math.round(q.maxPrice * 100) } : {}),
      },
    });
  }
  if (q.rating) and.push({ ratingAvg: { gte: q.rating } });
  if (q.minDiscount) and.push({ discountPercent: { gte: q.minDiscount } });
  if (q.featured) and.push({ isFeatured: true });
  if (q.bestSeller) and.push({ isBestSeller: true });
  if (q.newArrival) and.push({ isNewArrival: true });
  if (q.color?.length) and.push({ variants: { some: { ...LIVE_VARIANT, color: { in: q.color, mode: 'insensitive' } } } });
  if (q.size?.length) and.push({ variants: { some: { ...LIVE_VARIANT, size: { in: q.size, mode: 'insensitive' } } } });
  if (q.inStock === true) and.push({ variants: { some: { ...LIVE_VARIANT, inventory: { availableStock: { gt: 0 } } } } });
  if (q.inStock === false) and.push({ variants: { none: { ...LIVE_VARIANT, inventory: { availableStock: { gt: 0 } } } } });

  return { AND: and };
}

function buildOrderBy(sort: ProductListQuery['sort'], hasSearch: boolean): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }, { id: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }, { id: 'asc' }];
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'asc' }];
    case 'popular':
      return [{ soldCount: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }];
    case 'rating':
      return [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }];
    case 'discount':
      return [{ discountPercent: 'desc' }, { id: 'asc' }];
    default:
      return hasSearch
        ? [{ soldCount: 'desc' }, { id: 'asc' }]
        : [{ isFeatured: 'desc' }, { soldCount: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  }
}

export async function listProducts(q: ProductListQuery) {
  const { skip, take, page, limit } = getPagination(q.page, q.limit, 60);
  const where = buildWhere(q);
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, include: cardInclude, orderBy: buildOrderBy(q.sort, Boolean(q.q)), skip, take }),
    prisma.product.count({ where }),
  ]);
  return { items: rows.map(toCard), meta: buildMeta(page, limit, total) };
}

/** Distinct filter values for the listing sidebar, scoped to the current category/search. */
export async function getFacets(q: Pick<ProductListQuery, 'category' | 'subcategory' | 'q'>) {
  const where = buildWhere({ ...q, sort: 'relevance', page: 1, limit: 1 } as ProductListQuery);
  const [brands, variants, price] = await Promise.all([
    prisma.product.groupBy({ by: ['brand'], where, _count: { _all: true }, orderBy: { brand: 'asc' } }),
    prisma.productVariant.findMany({
      where: { ...LIVE_VARIANT, product: where },
      select: { color: true, colorHex: true, size: true },
      distinct: ['color', 'size'],
    }),
    prisma.product.aggregate({ where, _min: { price: true }, _max: { price: true } }),
  ]);
  const colors = new Map<string, string | null>();
  const sizes = new Set<string>();
  for (const v of variants) {
    if (v.color) colors.set(v.color, v.colorHex);
    if (v.size) sizes.add(v.size);
  }
  return {
    brands: brands.map((b) => ({ name: b.brand, count: b._count._all })),
    colors: [...colors].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name)),
    sizes: [...sizes].sort(),
    priceRange: { min: price._min.price ?? 0, max: price._max.price ?? 0 },
  };
}

export async function searchSuggestions(term: string) {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: buildWhere({ q: term, sort: 'relevance', page: 1, limit: 6 } as ProductListQuery),
      orderBy: [{ soldCount: 'desc' }, { id: 'asc' }],
      take: 6,
      select: {
        name: true,
        slug: true,
        price: true,
        category: { select: { slug: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
      },
    }),
    prisma.category.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [{ name: { contains: term, mode: 'insensitive' } }, { subcategories: { some: { name: { contains: term, mode: 'insensitive' }, deletedAt: null } } }],
      },
      select: { name: true, slug: true },
      take: 3,
    }),
  ]);
  return {
    products: products.map((p) => ({ name: p.name, slug: p.slug, price: p.price, category: p.category, image: p.images[0]?.url ?? null })),
    categories,
  };
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, ...LIVE_PRODUCT },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true, altText: true } },
      specifications: { orderBy: { sortOrder: 'asc' }, select: { label: true, value: true } },
      variants: {
        where: LIVE_VARIANT,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          sku: true,
          name: true,
          color: true,
          colorHex: true,
          size: true,
          price: true,
          mrp: true,
          inventory: { select: { availableStock: true, lowStockThreshold: true } },
        },
      },
    },
  });
  if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');

  const ratingGroups = await prisma.review.groupBy({
    by: ['rating'],
    where: { productId: product.id, status: 'APPROVED' },
    _count: { _all: true },
  });
  const ratingBreakdown = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: ratingGroups.find((g) => g.rating === r)?._count._all ?? 0 }));

  const variants = product.variants.map(({ inventory, price, mrp, ...v }) => {
    const available = inventory?.availableStock ?? 0;
    const effectivePrice = price ?? product.price;
    const effectiveMrp = mrp ?? product.mrp;
    return {
      ...v,
      price: effectivePrice,
      mrp: effectiveMrp,
      discountPercent: discountPercent(effectiveMrp, effectivePrice),
      inStock: available > 0,
      // Exact stock is only revealed when low, to create urgency without leaking inventory levels.
      lowStock: available > 0 && available <= (inventory?.lowStockThreshold ?? 5) ? available : null,
    };
  });

  const { deletedAt: _d, soldCount: _s, isActive: _a, ...rest } = product;
  return {
    ...rest,
    gstRate: Number(product.gstRate),
    ratingAvg: Math.round(product.ratingAvg * 10) / 10,
    variants,
    inStock: variants.some((v) => v.inStock),
    ratingBreakdown,
  };
}

export async function getRelatedProducts(slug: string, limit = 8) {
  const product = await prisma.product.findFirst({ where: { slug, deletedAt: null }, select: { id: true, categoryId: true, subcategoryId: true, tags: true } });
  if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  const rows = await prisma.product.findMany({
    where: {
      AND: [
        LIVE_PRODUCT,
        { id: { not: product.id } },
        {
          OR: [
            ...(product.subcategoryId ? [{ subcategoryId: product.subcategoryId }] : []),
            { categoryId: product.categoryId },
            ...(product.tags.length ? [{ tags: { hasSome: product.tags } }] : []),
          ],
        },
      ],
    },
    include: cardInclude,
    orderBy: [{ soldCount: 'desc' }, { ratingAvg: 'desc' }],
    take: limit,
  });
  return rows.map(toCard);
}

export async function getHomeSections() {
  const take = 8;
  const sectionQuery = (where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput[]) =>
    prisma.product.findMany({ where: { AND: [LIVE_PRODUCT, where] }, include: cardInclude, orderBy, take }).then((r) => r.map(toCard));

  const [featured, newArrivals, bestSellers, cosmetics, lace, jewellery, offers] = await Promise.all([
    sectionQuery({ isFeatured: true }, [{ soldCount: 'desc' }]),
    sectionQuery({ isNewArrival: true }, [{ createdAt: 'desc' }]),
    sectionQuery({ isBestSeller: true }, [{ soldCount: 'desc' }]),
    sectionQuery({ category: { slug: 'cosmetics' } }, [{ isFeatured: 'desc' }, { soldCount: 'desc' }]),
    sectionQuery({ category: { slug: 'lace' } }, [{ isFeatured: 'desc' }, { soldCount: 'desc' }]),
    sectionQuery({ category: { slug: 'artificial-jewellery' } }, [{ isFeatured: 'desc' }, { soldCount: 'desc' }]),
    sectionQuery({ discountPercent: { gte: 25 } }, [{ discountPercent: 'desc' }]),
  ]);
  return { featured, newArrivals, bestSellers, cosmetics, lace, jewellery, offers };
}

// ───────────────────────────── Admin ─────────────────────────────

export async function adminListProducts(params: { q?: string; categoryId?: string; status: 'active' | 'inactive' | 'all'; page: number; limit: number }) {
  const { skip, take, page, limit } = getPagination(params.page, params.limit, 100);
  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.status === 'active' ? { isActive: true } : params.status === 'inactive' ? { isActive: false } : {}),
    ...(params.q
      ? { OR: [{ name: { contains: params.q, mode: 'insensitive' } }, { sku: { contains: params.q, mode: 'insensitive' } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        variants: { where: { deletedAt: null }, select: { inventory: { select: { totalStock: true, reservedStock: true, availableStock: true, lowStockThreshold: true } } } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return {
    items: items.map(({ variants, ...p }) => {
      const stock = variants.reduce(
        (acc, v) => ({
          total: acc.total + (v.inventory?.totalStock ?? 0),
          reserved: acc.reserved + (v.inventory?.reservedStock ?? 0),
          available: acc.available + (v.inventory?.availableStock ?? 0),
          low: acc.low || (v.inventory ? v.inventory.availableStock <= v.inventory.lowStockThreshold : false),
        }),
        { total: 0, reserved: 0, available: 0, low: false },
      );
      return { ...p, gstRate: Number(p.gstRate), variantCount: variants.length, stock };
    }),
    meta: buildMeta(page, limit, total),
  };
}

export async function adminGetProduct(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      specifications: { orderBy: { sortOrder: 'asc' } },
      variants: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' }, include: { inventory: true } },
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
    },
  });
  if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  return { ...product, gstRate: Number(product.gstRate) };
}

async function assertCategory(categoryId: string, subcategoryId?: string | null) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, deletedAt: null } });
  if (!category) throw AppError.badRequest('Category does not exist', 'INVALID_CATEGORY');
  if (subcategoryId) {
    const sub = await prisma.subcategory.findFirst({ where: { id: subcategoryId, categoryId, deletedAt: null } });
    if (!sub) throw AppError.badRequest('Subcategory does not belong to the selected category', 'INVALID_SUBCATEGORY');
  }
}

function assertVariantPrices(variants: VariantInput[] | undefined, productMrp: number, productPrice: number) {
  for (const v of variants ?? []) {
    const price = v.price ?? productPrice;
    const mrp = v.mrp ?? productMrp;
    if (price > mrp) throw AppError.badRequest(`Variant ${v.sku}: selling price cannot exceed MRP`, 'INVALID_VARIANT_PRICE');
  }
}

async function createVariantWithStock(tx: Prisma.TransactionClient, productId: string, v: VariantInput, index: number, performedById: string, defaultThreshold: number) {
  const stock = v.initialStock ?? 0;
  const variant = await tx.productVariant.create({
    data: {
      productId,
      sku: v.sku,
      name: v.name,
      color: v.color,
      colorHex: v.colorHex,
      size: v.size,
      price: v.price ?? null,
      mrp: v.mrp ?? null,
      isActive: v.isActive ?? true,
      sortOrder: v.sortOrder ?? index,
      inventory: {
        create: { totalStock: stock, availableStock: stock, reservedStock: 0, lowStockThreshold: v.lowStockThreshold ?? defaultThreshold },
      },
    },
    include: { inventory: true },
  });
  if (stock > 0 && variant.inventory) {
    await tx.inventoryTransaction.create({
      data: { inventoryId: variant.inventory.id, type: 'RESTOCK', quantity: stock, totalAfter: stock, reservedAfter: 0, reason: 'Initial stock', performedById },
    });
  }
  return variant;
}

export async function createProduct(input: CreateProductInput, performedById: string, defaultThreshold = 5) {
  await assertCategory(input.categoryId, input.subcategoryId);
  const variants: VariantInput[] = input.variants?.length ? input.variants : [{ sku: `${input.sku}-STD`, name: 'Standard', color: undefined, size: undefined, initialStock: 0 }];
  assertVariantPrices(variants, input.mrp, input.price);

  const { images, specifications, variants: _v, slug, ...data } = input;
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        ...data,
        slug: slug ?? (await uniqueSlug(input.name)),
        discountPercent: discountPercent(input.mrp, input.price),
        images: images?.length ? { create: images.map((img, i) => ({ ...img, sortOrder: i })) } : undefined,
        specifications: specifications?.length ? { create: specifications.map((s, i) => ({ ...s, sortOrder: i })) } : undefined,
      },
    });
    for (const [i, v] of variants.entries()) await createVariantWithStock(tx, product.id, v, i, performedById, defaultThreshold);
    return product;
  }).then((p) => adminGetProduct(p.id));
}

export async function updateProduct(id: string, input: UpdateProductInput, performedById: string, defaultThreshold = 5) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  const categoryId = input.categoryId ?? existing.categoryId;
  if (input.categoryId || input.subcategoryId) await assertCategory(categoryId, input.subcategoryId ?? existing.subcategoryId);
  const mrp = input.mrp ?? existing.mrp;
  const price = input.price ?? existing.price;
  if (price > mrp) throw AppError.badRequest('Selling price cannot exceed MRP', 'INVALID_PRICE');
  assertVariantPrices(input.variants, mrp, price);

  const { images, specifications, variants, ...data } = input;
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { ...data, discountPercent: discountPercent(mrp, price) } });

    if (images) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (images.length) await tx.productImage.createMany({ data: images.map((img, i) => ({ ...img, productId: id, sortOrder: i })) });
    }
    if (specifications) {
      await tx.productSpecification.deleteMany({ where: { productId: id } });
      if (specifications.length) await tx.productSpecification.createMany({ data: specifications.map((s, i) => ({ ...s, productId: id, sortOrder: i })) });
    }
    if (variants) {
      const current = await tx.productVariant.findMany({ where: { productId: id, deletedAt: null } });
      const keepIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));
      for (const [i, v] of variants.entries()) {
        if (v.id) {
          if (!current.some((c) => c.id === v.id)) throw AppError.badRequest(`Variant ${v.id} does not belong to this product`, 'INVALID_VARIANT');
          await tx.productVariant.update({
            where: { id: v.id },
            data: { sku: v.sku, name: v.name, color: v.color ?? null, colorHex: v.colorHex ?? null, size: v.size ?? null, price: v.price ?? null, mrp: v.mrp ?? null, isActive: v.isActive ?? true, sortOrder: v.sortOrder ?? i },
          });
          if (v.lowStockThreshold !== undefined) await tx.inventory.update({ where: { variantId: v.id }, data: { lowStockThreshold: v.lowStockThreshold } });
        } else {
          await createVariantWithStock(tx, id, v, i, performedById, defaultThreshold);
        }
      }
      // Removed variants are soft-deleted: past orders keep referencing them.
      const removed = current.filter((c) => !keepIds.has(c.id));
      for (const r of removed) {
        await tx.productVariant.update({ where: { id: r.id }, data: { deletedAt: new Date(), isActive: false, sku: `${r.sku}--deleted-${Date.now()}` } });
        await tx.cartItem.deleteMany({ where: { variantId: r.id } });
      }
      const remaining = await tx.productVariant.count({ where: { productId: id, deletedAt: null } });
      if (remaining === 0) throw AppError.badRequest('A product must have at least one variant', 'NO_VARIANTS');
    }
  });
  return adminGetProduct(id);
}

export async function setProductActive(id: string, isActive: boolean) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  return prisma.product.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
}

/**
 * Products are never hard-deleted: historical orders reference them. The slug/SKU are freed so they can be reused.
 */
export async function deleteProduct(id: string) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null }, include: { variants: true } });
  if (!existing) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  const suffix = `--deleted-${Date.now()}`;
  await prisma.$transaction(async (tx) => {
    for (const v of existing.variants) {
      if (!v.deletedAt) await tx.productVariant.update({ where: { id: v.id }, data: { deletedAt: new Date(), isActive: false, sku: v.sku + suffix } });
    }
    await tx.cartItem.deleteMany({ where: { productId: id } });
    await tx.wishlistItem.deleteMany({ where: { productId: id } });
    await tx.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, slug: existing.slug + suffix, sku: existing.sku + suffix } });
  });
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'product';
  let slug = base;
  for (let i = 2; await prisma.product.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  return slug;
}

/** Slugs for sitemap generation. */
export async function listProductSlugs() {
  return prisma.product.findMany({
    where: LIVE_PRODUCT,
    select: { slug: true, updatedAt: true, category: { select: { slug: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 50000,
  });
}
