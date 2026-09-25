import { z } from 'zod';
import { booleanQuery, optionalText } from './common';

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30) : undefined));

export const PRODUCT_SORTS = ['relevance', 'price_asc', 'price_desc', 'newest', 'popular', 'rating', 'discount'] as const;

export const productListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  subcategory: z.string().trim().max(80).optional(),
  brand: csv,
  color: csv,
  size: csv,
  tags: csv,
  ids: csv,
  /** Rupees (converted to paise in the service) */
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  minDiscount: z.coerce.number().int().min(0).max(100).optional(),
  inStock: booleanQuery,
  featured: booleanQuery,
  bestSeller: booleanQuery,
  newArrival: booleanQuery,
  sort: z.enum(PRODUCT_SORTS).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export type ProductListQuery = z.infer<typeof productListQuery>;

export const suggestionQuery = z.object({ q: z.string().trim().min(1).max(100) });

const money = z.number().int('Amounts must be integer paise').positive();

const variantInput = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(2).max(64),
  name: z.string().trim().min(1).max(120),
  color: optionalText(60),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  size: optionalText(40),
  price: money.optional().nullable(),
  mrp: money.optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  /** Initial stock — only used when the variant is created. Use inventory adjustments afterwards. */
  initialStock: z.number().int().min(0).max(100000).optional(),
  lowStockThreshold: z.number().int().min(0).max(10000).optional(),
});

const imageInput = z.object({
  url: z.string().trim().min(1).max(1000),
  publicId: z.string().max(300).optional().nullable(),
  altText: optionalText(200),
});

const specInput = z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(500) });

const productBase = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120)
    .optional(),
  sku: z.string().trim().min(2).max(64),
  description: z.string().trim().min(10).max(10000),
  shortDescription: optionalText(300),
  categoryId: z.string().min(1),
  subcategoryId: z.string().min(1).optional().nullable(),
  brand: z.string().trim().min(1).max(80).optional(),
  mrp: money,
  price: money,
  gstRate: z.number().min(0).max(40).optional(),
  hsnCode: optionalText(20),
  weightGrams: z.number().int().min(1).max(50000).optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30).optional(),
  ingredients: optionalText(5000),
  howToUse: optionalText(5000),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isActive: z.boolean().optional(),
  metaTitle: optionalText(160),
  metaDescription: optionalText(320),
  images: z.array(imageInput).max(12).optional(),
  specifications: z.array(specInput).max(40).optional(),
  variants: z.array(variantInput).min(1).max(50).optional(),
});

const priceRule = (v: { mrp?: number; price?: number }) => v.mrp === undefined || v.price === undefined || v.price <= v.mrp;

export const createProductSchema = productBase.refine(priceRule, { message: 'Selling price cannot exceed MRP', path: ['price'] });
export const updateProductSchema = productBase.partial().refine(priceRule, { message: 'Selling price cannot exceed MRP', path: ['price'] });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type VariantInput = z.infer<typeof variantInput>;

export const adminProductListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
