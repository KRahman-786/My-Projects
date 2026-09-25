import type { PaymentMethod } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { buildQuote, MAX_QTY_PER_LINE, type QuoteItemInput } from './pricing.service';
import { evaluateCoupon } from './coupon.service';

async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({ where: { userId }, update: {}, create: { userId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
}

export interface CartViewOptions {
  pincode?: string;
  state?: string;
  paymentMethod?: PaymentMethod;
}

/** Cart with live prices, stock issues, coupon, tax and shipping computed by the pricing service. */
export async function getCart(userId: string, opts: CartViewOptions = {}) {
  const cart = await getOrCreateCart(userId);
  const quote = await buildQuote(
    cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    { userId, couponCode: cart.couponCode, ...opts },
  );
  const itemIdByVariant = new Map(cart.items.map((i) => [i.variantId, i.id]));
  const withIds = <T extends { variantId: string }>(l: T) => ({ ...l, itemId: itemIdByVariant.get(l.variantId)! });
  return {
    ...quote,
    lines: quote.lines.map(withIds),
    unavailable: quote.unavailable.map(withIds),
    couponCode: cart.couponCode,
  };
}

async function assertPurchasable(variantId: string, quantity: number) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { inventory: true, product: { select: { id: true, name: true, isActive: true, deletedAt: true } } },
  });
  if (!variant || !variant.isActive || variant.deletedAt || !variant.product.isActive || variant.product.deletedAt) {
    throw AppError.notFound('This product is not available', 'PRODUCT_UNAVAILABLE');
  }
  const available = variant.inventory?.availableStock ?? 0;
  if (available <= 0) throw AppError.conflict(`${variant.product.name} is out of stock`, 'OUT_OF_STOCK');
  if (quantity > available) throw AppError.conflict(`Only ${available} unit(s) available`, 'INSUFFICIENT_STOCK', { available });
  if (quantity > MAX_QTY_PER_LINE) throw AppError.badRequest(`You can buy up to ${MAX_QTY_PER_LINE} units of an item`, 'MAX_QUANTITY_EXCEEDED');
  return variant;
}

export async function addItem(userId: string, variantId: string, quantity: number) {
  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find((i) => i.variantId === variantId);
  const newQty = (existing?.quantity ?? 0) + quantity;
  const variant = await assertPurchasable(variantId, newQty);
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    update: { quantity: newQty },
    create: { cartId: cart.id, variantId, productId: variant.productId, quantity },
  });
}

async function getOwnedItem(userId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
  if (!item) throw AppError.notFound('Cart item not found', 'CART_ITEM_NOT_FOUND');
  return item;
}

export async function updateItem(userId: string, itemId: string, quantity: number) {
  const item = await getOwnedItem(userId, itemId);
  if (quantity > item.quantity) await assertPurchasable(item.variantId, quantity);
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function removeItem(userId: string, itemId: string) {
  const item = await getOwnedItem(userId, itemId);
  await prisma.cartItem.delete({ where: { id: item.id } });
}

export async function clearCart(userId: string) {
  await prisma.cart.update({ where: { userId }, data: { couponCode: null, items: { deleteMany: {} } } });
}

export async function applyCoupon(userId: string, code: string) {
  const cart = await getOrCreateCart(userId);
  const quote = await buildQuote(cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), { userId });
  if (!quote.lines.length) throw AppError.badRequest('Add items to your cart before applying a coupon', 'CART_EMPTY');
  // Throws a descriptive AppError when invalid.
  await evaluateCoupon(code, quote.lines, userId);
  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code.toUpperCase() } });
}

export async function removeCoupon(userId: string) {
  await prisma.cart.update({ where: { userId }, data: { couponCode: null } });
}

/** Merges a guest (localStorage) cart after login, clamping quantities to available stock. */
export async function mergeGuestCart(userId: string, items: QuoteItemInput[]) {
  const cart = await getOrCreateCart(userId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) }, isActive: true, deletedAt: null, product: { isActive: true, deletedAt: null } },
    include: { inventory: { select: { availableStock: true } } },
  });
  for (const item of items) {
    const v = variants.find((x) => x.id === item.variantId);
    if (!v) continue;
    const existing = cart.items.find((i) => i.variantId === item.variantId);
    const qty = Math.min(Math.max(existing?.quantity ?? 0, item.quantity), v.inventory?.availableStock ?? 0, MAX_QTY_PER_LINE);
    if (qty <= 0) continue;
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
      update: { quantity: qty },
      create: { cartId: cart.id, variantId: v.id, productId: v.productId, quantity: qty },
    });
  }
}

export async function cartCount(userId: string) {
  const agg = await prisma.cartItem.aggregate({ where: { cart: { userId } }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}
