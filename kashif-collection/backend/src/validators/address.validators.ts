import { z } from 'zod';
import { optionalText, phoneSchema, pincodeSchema } from './common';

export const addressSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  house: z.string().trim().min(1, 'House / flat is required').max(120),
  street: z.string().trim().min(1, 'Street is required').max(160),
  area: optionalText(120),
  landmark: optionalText(120),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80).default('Uttar Pradesh'),
  pincode: pincodeSchema,
  country: z.string().trim().default('India').refine((v) => v === 'India', 'We currently ship within India only'),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = addressSchema.partial();
export type AddressInput = z.infer<typeof addressSchema>;
