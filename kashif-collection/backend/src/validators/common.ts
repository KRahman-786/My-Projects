import { z } from 'zod';

export const idParam = z.object({ id: z.string().min(1).max(64) });
export const slugParam = z.object({ slug: z.string().min(1).max(120) });

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'));

export const pincodeSchema = z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Trimmed optional string that treats "" as undefined. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? undefined : v))
    .optional();

export const booleanQuery = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true' || v === '1'));
