import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { slugify } from '../utils/slug';
import type { CategoryInput, SubcategoryInput } from '../validators/category.validators';

const activeProduct = { isActive: true, deletedAt: null };

export async function listCategories(includeInactive = false) {
  const where = includeInactive ? { deletedAt: null } : { deletedAt: null, isActive: true };
  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      subcategories: { where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: { where: activeProduct } } } } },
      _count: { select: { products: { where: activeProduct } } },
    },
  });
  return categories.map(({ _count, subcategories, ...c }) => ({
    ...c,
    productCount: _count.products,
    subcategories: subcategories.map(({ _count: sc, ...s }) => ({ ...s, productCount: sc.products })),
  }));
}

export async function getCategoryBySlug(slug: string) {
  const category = await prisma.category.findFirst({
    where: { slug, deletedAt: null, isActive: true },
    include: { subcategories: { where: { deletedAt: null, isActive: true }, orderBy: { sortOrder: 'asc' } } },
  });
  if (!category) throw AppError.notFound('Category not found', 'CATEGORY_NOT_FOUND');
  return category;
}

export async function createCategory(input: CategoryInput) {
  return prisma.category.create({ data: { ...input, slug: input.slug ?? slugify(input.name) } });
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  await ensureCategory(id);
  return prisma.category.update({ where: { id }, data: input });
}

/** Soft delete. Refused while active products still belong to the category. */
export async function deleteCategory(id: string) {
  const category = await ensureCategory(id);
  const products = await prisma.product.count({ where: { categoryId: id, deletedAt: null } });
  if (products > 0) {
    throw AppError.conflict(`Move or delete the ${products} product(s) in this category first`, 'CATEGORY_NOT_EMPTY');
  }
  const suffix = `--deleted-${Date.now()}`;
  await prisma.$transaction([
    prisma.subcategory.updateMany({ where: { categoryId: id, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } }),
    prisma.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, slug: category.slug + suffix } }),
  ]);
}

async function ensureCategory(id: string) {
  const category = await prisma.category.findFirst({ where: { id, deletedAt: null } });
  if (!category) throw AppError.notFound('Category not found', 'CATEGORY_NOT_FOUND');
  return category;
}

export async function createSubcategory(input: SubcategoryInput) {
  await ensureCategory(input.categoryId);
  return prisma.subcategory.create({ data: { ...input, slug: input.slug ?? slugify(input.name) } });
}

export async function updateSubcategory(id: string, input: Partial<SubcategoryInput>) {
  await ensureSubcategory(id);
  if (input.categoryId) await ensureCategory(input.categoryId);
  return prisma.subcategory.update({ where: { id }, data: input });
}

export async function deleteSubcategory(id: string) {
  const sub = await ensureSubcategory(id);
  const products = await prisma.product.count({ where: { subcategoryId: id, deletedAt: null } });
  if (products > 0) {
    throw AppError.conflict(`Move or delete the ${products} product(s) in this subcategory first`, 'SUBCATEGORY_NOT_EMPTY');
  }
  await prisma.subcategory.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, slug: `${sub.slug}--deleted-${Date.now()}` } });
}

async function ensureSubcategory(id: string) {
  const sub = await prisma.subcategory.findFirst({ where: { id, deletedAt: null } });
  if (!sub) throw AppError.notFound('Subcategory not found', 'SUBCATEGORY_NOT_FOUND');
  return sub;
}
