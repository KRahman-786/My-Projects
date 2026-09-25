import type { MetadataRoute } from 'next';
import { catalog } from '@/services/catalog';
import { SITE } from '@/lib/site';

export const revalidate = 3600;

const STATIC = ['', '/products', '/about', '/contact', '/faq', '/shipping-policy', '/return-policy', '/cancellation-policy', '/privacy-policy', '/terms'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await catalog.sitemap().catch(() => ({ products: [], categories: [] }));
  const now = new Date();
  return [
    ...STATIC.map((p) => ({ url: `${SITE.url}${p}`, lastModified: now, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.5 })),
    ...data.categories.flatMap((c) => [
      { url: `${SITE.url}/category/${c.slug}`, lastModified: new Date(c.updatedAt), changeFrequency: 'daily' as const, priority: 0.8 },
      ...c.subcategories.map((s) => ({ url: `${SITE.url}/category/${c.slug}/${s}`, lastModified: new Date(c.updatedAt), changeFrequency: 'daily' as const, priority: 0.7 })),
    ]),
    ...data.products.map((p) => ({ url: `${SITE.url}/products/${p.category}/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: 'weekly' as const, priority: 0.9 })),
  ];
}
