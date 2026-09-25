import type { Request, Response } from 'express';
import * as cartService from '../services/cart.service';
import * as wishlistService from '../services/wishlist.service';
import { buildQuote } from '../services/pricing.service';
import { evaluateCoupon } from '../services/coupon.service';
import { currentUser } from '../middleware/auth';
import { parseParams, parseQuery } from '../middleware/validate';
import { idParam } from '../validators/common';
import { cartQuery } from '../validators/cart.validators';
import { ok } from '../utils/response';
import { z } from 'zod';

export async function getCart(req: Request, res: Response) {
  const q = parseQuery(cartQuery, req);
  ok(res, await cartService.getCart(currentUser(req).id, q));
}

export async function addItem(req: Request, res: Response) {
  await cartService.addItem(currentUser(req).id, req.body.variantId, req.body.quantity);
  ok(res, await cartService.getCart(currentUser(req).id), { status: 201, message: 'Added to cart' });
}

export async function updateItem(req: Request, res: Response) {
  const { id } = parseParams(idParam, req);
  await cartService.updateItem(currentUser(req).id, id, req.body.quantity);
  ok(res, await cartService.getCart(currentUser(req).id));
}

export async function removeItem(req: Request, res: Response) {
  const { id } = parseParams(idParam, req);
  await cartService.removeItem(currentUser(req).id, id);
  ok(res, await cartService.getCart(currentUser(req).id), { message: 'Item removed' });
}

export async function clearCart(req: Request, res: Response) {
  await cartService.clearCart(currentUser(req).id);
  ok(res, await cartService.getCart(currentUser(req).id));
}

export async function applyCoupon(req: Request, res: Response) {
  await cartService.applyCoupon(currentUser(req).id, req.body.code);
  ok(res, await cartService.getCart(currentUser(req).id), { message: 'Coupon applied' });
}

export async function removeCoupon(req: Request, res: Response) {
  await cartService.removeCoupon(currentUser(req).id);
  ok(res, await cartService.getCart(currentUser(req).id), { message: 'Coupon removed' });
}

export async function mergeCart(req: Request, res: Response) {
  await cartService.mergeGuestCart(currentUser(req).id, req.body.items);
  ok(res, await cartService.getCart(currentUser(req).id));
}

/** Guest cart pricing (no login). Prices always come from the database. */
export async function quote(req: Request, res: Response) {
  ok(res, await buildQuote(req.body.items, { couponCode: req.body.couponCode, pincode: req.body.pincode, userId: req.user?.id }));
}

/** POST /api/coupons/validate — for logged in users validates against their cart unless items are supplied. */
export async function validateCoupon(req: Request, res: Response) {
  const userId = req.user?.id;
  let items: { variantId: string; quantity: number }[] = req.body.items ?? [];
  if (!items.length && userId) {
    const cart = await cartService.getCart(userId);
    items = cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
  }
  const q = await buildQuote(items, { userId });
  const result = await evaluateCoupon(req.body.code, q.lines, userId);
  ok(res, { code: result.coupon.code, description: result.coupon.description, discount: result.discount }, { message: 'Coupon is valid' });
}

export async function getWishlist(req: Request, res: Response) {
  ok(res, await wishlistService.getWishlist(currentUser(req).id));
}
export async function wishlistIds(req: Request, res: Response) {
  ok(res, await wishlistService.wishlistProductIds(currentUser(req).id));
}
export const wishlistAddSchema = z.object({ productId: z.string().min(1), variantId: z.string().min(1).optional() });
export async function addWishlist(req: Request, res: Response) {
  await wishlistService.addToWishlist(currentUser(req).id, req.body.productId, req.body.variantId);
  ok(res, null, { status: 201, message: 'Added to wishlist' });
}
export async function removeWishlist(req: Request, res: Response) {
  const { id } = parseParams(idParam, req);
  await wishlistService.removeFromWishlist(currentUser(req).id, id);
  ok(res, null, { message: 'Removed from wishlist' });
}
export const moveToCartSchema = z.object({ variantId: z.string().min(1).optional() });
export async function moveToCart(req: Request, res: Response) {
  const { id } = parseParams(idParam, req);
  await wishlistService.moveToCart(currentUser(req).id, id, req.body.variantId);
  ok(res, null, { message: 'Moved to cart' });
}
