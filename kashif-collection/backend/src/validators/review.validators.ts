import { z } from 'zod';
import { optionalText } from './common';

export const createReviewSchema = z.object({
  productId: z.string().min(1),
  orderItemId: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  title: optionalText(120),
  body: z.string().trim().min(10, 'Please write at least 10 characters').max(2000),
  imageUrl: z.string().url().max(500).optional(),
  imagePublicId: z.string().max(300).optional(),
});

export const reviewListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['recent', 'highest', 'lowest']).default('recent'),
});

export const adminReviewQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'HIDDEN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewStatusSchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'HIDDEN']) });
