import { z } from 'zod';
import { optionalText } from './common';

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and hyphens').max(80);

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slug.optional(),
  description: optionalText(1000),
  imageUrl: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});
export const updateCategorySchema = categorySchema.partial();

export const subcategorySchema = categorySchema.extend({ categoryId: z.string().min(1) });
export const updateSubcategorySchema = subcategorySchema.partial();

export type CategoryInput = z.infer<typeof categorySchema>;
export type SubcategoryInput = z.infer<typeof subcategorySchema>;
