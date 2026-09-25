import { z } from 'zod';
import { pincodeSchema } from './common';

export const addCartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const updateCartItemSchema = z.object({ quantity: z.number().int().min(1).max(10) });

export const couponCodeSchema = z.object({ code: z.string().trim().min(2).max(40).toUpperCase() });

const itemList = z.array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(1).max(10) })).max(50);

/** Guest cart pricing — items come from localStorage, prices are always looked up server-side. */
export const quoteSchema = z.object({
  items: itemList,
  couponCode: z.string().trim().max(40).optional(),
  pincode: pincodeSchema.optional(),
});

export const mergeCartSchema = z.object({ items: itemList });

export const cartQuery = z.object({
  pincode: pincodeSchema.optional(),
  state: z.string().trim().max(80).optional(),
  paymentMethod: z.enum(['RAZORPAY', 'STRIPE', 'COD']).optional(),
});

export const validateCouponSchema = z.object({
  code: z.string().trim().min(2).max(40).toUpperCase(),
  items: itemList.optional(),
});
