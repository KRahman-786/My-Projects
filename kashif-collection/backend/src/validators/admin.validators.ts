import { z } from 'zod';
import { booleanQuery, optionalText } from './common';

export const inventoryQuery = z.object({
  q: z.string().trim().max(100).optional(),
  lowStock: booleanQuery,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const adjustInventorySchema = z.object({
  variantId: z.string().min(1),
  delta: z.number().int().min(-100000).max(100000),
  type: z.enum(['RESTOCK', 'ADJUSTMENT']).default('ADJUSTMENT'),
  reason: z.string().trim().min(3, 'Please give a reason for the audit trail').max(300),
  lowStockThreshold: z.number().int().min(0).max(10000).optional(),
});

export const customerQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const activeSchema = z.object({ isActive: z.boolean() });

const couponBase = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Use 3–30 letters, numbers, - or _'),
  description: optionalText(300),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().int().positive(),
  minCartValue: z.number().int().min(0).optional(),
  maxDiscount: z.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  categoryIds: z.array(z.string()).max(50).optional(),
  productIds: z.array(z.string()).max(200).optional(),
});
const pctRule = (c: { type?: string; value?: number }) => c.type !== 'PERCENTAGE' || c.value === undefined || c.value <= 100;
export const couponSchema = couponBase.refine(pctRule, { message: 'Percentage cannot exceed 100', path: ['value'] });
export const updateCouponSchema = couponBase.partial().refine(pctRule, { message: 'Percentage cannot exceed 100', path: ['value'] });

export const settingsSchema = z
  .object({
    codEnabled: z.boolean(),
    codMinOrderValue: z.number().int().min(0),
    codMaxOrderValue: z.number().int().min(0),
    codFee: z.number().int().min(0),
    flatShippingFee: z.number().int().min(0),
    freeShippingThreshold: z.number().int().min(0),
    pricesIncludeTax: z.boolean(),
    defaultGstRate: z.number().min(0).max(40),
    businessState: z.string().trim().min(2).max(80),
    orderReservationMinutes: z.number().int().min(5).max(1440),
    returnWindowDays: z.number().int().min(0).max(60),
    defaultLowStockThreshold: z.number().int().min(0).max(10000),
  })
  .partial();

export const pincodeOverrideSchema = z.object({
  pincode: z.string().regex(/^[1-9][0-9]{5}$/),
  city: optionalText(80),
  state: optionalText(80),
  isServiceable: z.boolean().default(true),
  codAvailable: z.boolean().default(true),
  deliveryDays: z.number().int().min(1).max(30).default(5),
});

export const listQuery = z.object({
  status: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  phone: optionalText(20),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(3000),
});
