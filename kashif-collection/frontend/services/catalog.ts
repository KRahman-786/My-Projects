import { api, apiRequest } from '@/lib/api';
import type { Category, Facets, HomeData, Offer, ProductCard, ProductDetail, Review } from '@/types';

export interface ProductQuery {
  q?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  color?: string;
  size?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  minDiscount?: string;
  inStock?: string;
  sort?: string;
  page?: string;
  limit?: string;
  ids?: string;
  featured?: string;
  bestSeller?: string;
  newArrival?: string;
}

export const catalog = {
  home: () => api<HomeData>('/home', { revalidate: 60 }),
  categories: () => api<Category[]>('/categories', { revalidate: 300 }),
  category: (slug: string) => api<Category>(`/categories/${slug}`, { revalidate: 300 }),
  products: (query: ProductQuery) => apiRequest<ProductCard[]>('/products', { query: { ...query }, revalidate: 30 }),
  facets: (query: Pick<ProductQuery, 'q' | 'category' | 'subcategory'>) => api<Facets>('/products/facets', { query: { ...query }, revalidate: 120 }),
  product: (slug: string) => api<ProductDetail>(`/products/${slug}`, { revalidate: 30 }),
  related: (slug: string) => api<ProductCard[]>(`/products/${slug}/related`, { revalidate: 120 }),
  reviews: (slug: string, page = 1, sort = 'recent') =>
    apiRequest<{ items: Review[]; summary: { ratingAvg: number; ratingCount: number } }>(`/products/${slug}/reviews`, { query: { page, sort, limit: 5 } }),
  suggestions: (q: string) =>
    api<{ products: { name: string; slug: string; price: number; image: string | null; category: { slug: string; name: string } }[]; categories: { name: string; slug: string }[] }>(
      '/search/suggestions',
      { query: { q } },
    ),
  offers: () => api<Offer[]>('/offers', { revalidate: 120 }),
  sitemap: () =>
    api<{ products: { slug: string; category: string; updatedAt: string }[]; categories: { slug: string; subcategories: string[]; updatedAt: string }[] }>('/sitemap-data', {
      revalidate: 600,
    }),
};
