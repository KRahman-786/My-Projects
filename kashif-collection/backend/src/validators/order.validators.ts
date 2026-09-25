import { z } from 'zod';
import { optionalText } from './common';

export const ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED',
] as const;
export const PAYMENT_STATUSES = ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED'] as const;
export const PAYMENT_METHODS = ['RAZORPAY', 'STRIPE', 'COD'] as const;

export const orderNumberParam = z.object({ orderNumber: z.string().regex(/^KC-\d{4}-\d{6}$/, 'Invalid order number') });

export const createOrderSchema = z.object({
  addressId: z.string().min(1, 'Select a delivery address'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  couponCode: z.string().trim().max(40).toUpperCase().nullable().optional(),
  customerNote: optionalText(500),
  idempotencyKey: z.string().min(8).max(100).optional(),
  expectedTotal: z.number().int().nonnegative().optional(),
});

export const cancelOrderSchema = z.object({ reason: z.string().trim().min(3).max(300).default('Changed my mind') });

export const returnRequestSchema = z.object({
  reason: z.string().trim().min(3).max(200),
  details: optionalText(1000),
});

export const adminOrderQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(300),
  trackingNumber: optionalText(80),
  trackingUrl: z.url().max(500).optional(),
});

export const resolveReturnSchema = z.object({ action: z.enum(['APPROVE', 'REJECT', 'RECEIVE']), note: optionalText(500) });
export const processRefundSchema = z.object({ manualReference: optionalText(120) });

export const razorpayCreateSchema = z.object({ orderNumber: z.string().regex(/^KC-\d{4}-\d{6}$/) });
export const razorpayVerifySchema = z.object({
  orderNumber: z.string().regex(/^KC-\d{4}-\d{6}$/),
  razorpayOrderId: z.string().min(1).max(100),
  razorpayPaymentId: z.string().min(1).max(100),
  razorpaySignature: z.string().min(1).max(200),
});
export const razorpayFailureSchema = z.object({
  orderNumber: z.string().regex(/^KC-\d{4}-\d{6}$/),
  razorpayOrderId: z.string().min(1).max(100),
  reason: optionalText(300),
});
export const stripeCreateSchema = razorpayCreateSchema;
