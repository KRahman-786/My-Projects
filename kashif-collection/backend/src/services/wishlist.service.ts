import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { LIVE_PRODUCT, toCard } from './product.service';
import { addItem } from './cart.service';

async function getOrCreateWishlist(userId: string) {
  return prisma.wishlist.upsert({ where: { userId }, update: {}, create: { userId } });
}

export async function getWishlist(userId: string) {
  const wishlist = await getOrCreateWishlist(userId);
  const items = await prisma.wishlistItem.findMany({
    where: { wishlistId: wishlist.id, product: LIVE_PRODUCT },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        include: {
          category: { select: { name: true, slug: true } },
          subcategory: { select: { name: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 2, select: { url: true, altText: true } },
          variants: {
            where: { isActive: true, deletedAt: null },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true, color: true, colorHex: true, size: true, price: true, mrp: true, inventory: { select: { availableStock: true } } },
          },
        },
      },
    },
  });
  return items.map((i) => ({ id: i.id, variantId: i.variantId, addedAt: i.createdAt, product: toCard(i.product) }));
}

export async function wishlistProductIds(userId: string) {
  const items = await prisma.wishlistItem.findMany({ where: { wishlist: { userId } }, select: { productId: true } });
  return items.map((i) => i.productId);
}

export async function addToWishlist(userId: string, productId: string, variantId?: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, ...LIVE_PRODUCT } });
  if (!product) throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
  const wishlist = await getOrCreateWishlist(userId);
  await prisma.wishlistItem.upsert({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    update: { variantId: variantId ?? undefined },
    create: { wishlistId: wishlist.id, productId, variantId },
  });
}

export async function removeFromWishlist(userId: string, productId: string) {
  await prisma.wishlistItem.deleteMany({ where: { productId, wishlist: { userId } } });
}

/** Moves a wishlist product into the cart (uses the saved or only variant). */
export async function moveToCart(userId: string, productId: string, variantId?: string) {
  const item = await prisma.wishlistItem.findFirst({ where: { productId, wishlist: { userId } } });
  if (!item) throw AppError.notFound('Item is not in your wishlist', 'WISHLIST_ITEM_NOT_FOUND');
  let chosen = variantId ?? item.variantId ?? undefined;
  if (!chosen) {
    const variants = await prisma.productVariant.findMany({ where: { productId, isActive: true, deletedAt: null }, select: { id: true } });
    if (variants.length !== 1) throw AppError.badRequest('Please choose a shade/size for this product', 'VARIANT_REQUIRED');
    chosen = variants[0]!.id;
  }
  const variant = await prisma.productVariant.findFirst({ where: { id: chosen, productId } });
  if (!variant) throw AppError.badRequest('Invalid variant for this product', 'INVALID_VARIANT');
  await addItem(userId, chosen, 1);
  await prisma.wishlistItem.delete({ where: { id: item.id } });
}
