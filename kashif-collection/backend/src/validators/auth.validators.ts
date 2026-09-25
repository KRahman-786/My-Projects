import { z } from 'zod';
import { passwordSchema, phoneSchema } from './common';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  phone: phoneSchema.optional(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
