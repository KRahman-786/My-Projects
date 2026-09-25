import type { Request, Response } from 'express';
import * as categoryService from '../services/category.service';
import * as productService from '../services/product.service';
import * as reviewService from '../services/review.service';
import { listPublicCoupons } from '../services/coupon.service';
import { parseParams, parseQuery } from '../middleware/validate';
import { slugParam } from '../validators/common';
import { productListQuery, suggestionQuery } from '../validators/product.validators';
import { reviewListQuery } from '../validators/review.validators';
import { ok } from '../utils/response';

/** Short public caching for catalogue reads; the CDN/browser may reuse responses briefly. */
function cachePublic(res: Response, seconds = 60) {
  res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
}

export async function listCategories(_req: Request, res: Response) {
  cachePublic(res, 300);
  ok(res, await categoryService.listCategories());
}

export async function getCategory(req: Request, res: Response) {
  const { slug } = parseParams(slugParam, req);
  cachePublic(res, 300);
  ok(res, await categoryService.getCategoryBySlug(slug));
}

export async function listProducts(req: Request, res: Response) {
  const query = parseQuery(productListQuery, req);
  const { items, meta } = await productService.listProducts(query);
  cachePublic(res, 30);
  ok(res, items, { meta });
}

export async function facets(req: Request, res: Response) {
  const q = parseQuery(productListQuery.pick({ q: true, category: true, subcategory: true }), req);
  cachePublic(res, 120);
  ok(res, await productService.getFacets(q));
}

export async function getProduct(req: Request, res: Response) {
  const { slug } = parseParams(slugParam, req);
  cachePublic(res, 30);
  ok(res, await productService.getProductBySlug(slug));
}

export async function relatedProducts(req: Request, res: Response) {
  const { slug } = parseParams(slugParam, req);
  cachePublic(res, 120);
  ok(res, await productService.getRelatedProducts(slug));
}

export async function productReviews(req: Request, res: Response) {
  const { slug } = parseParams(slugParam, req);
  const q = parseQuery(reviewListQuery, req);
  const { items, meta, summary } = await reviewService.listProductReviews(slug, q.page, q.limit, q.sort);
  ok(res, { items, summary }, { meta });
}

export async function suggestions(req: Request, res: Response) {
  const { q } = parseQuery(suggestionQuery, req);
  cachePublic(res, 60);
  ok(res, await productService.searchSuggestions(q));
}

export async function home(_req: Request, res: Response) {
  const [sections, categories, reviews, coupons] = await Promise.all([
    productService.getHomeSections(),
    categoryService.listCategories(),
    reviewService.featuredReviews(6),
    listPublicCoupons(),
  ]);
  cachePublic(res, 60);
  ok(res, { ...sections, categories, reviews, coupons });
}

export async function productSlugs(_req: Request, res: Response) {
  const [products, categories] = await Promise.all([productService.listProductSlugs(), categoryService.listCategories()]);
  cachePublic(res, 600);
  ok(res, {
    products: products.map((p) => ({ slug: p.slug, category: p.category.slug, updatedAt: p.updatedAt })),
    categories: categories.map((c) => ({ slug: c.slug, subcategories: c.subcategories.map((s) => s.slug), updatedAt: c.updatedAt })),
  });
}

export async function offers(_req: Request, res: Response) {
  cachePublic(res, 120);
  ok(res, await listPublicCoupons());
}
