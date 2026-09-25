import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { catalog } from '@/services/catalog';
import { ApiError } from '@/lib/api';
import { SITE } from '@/lib/site';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ProductGallery } from '@/components/product/ProductGallery';
import { BuyBox } from '@/components/product/BuyBox';
import { ProductInfoTabs } from '@/components/product/ProductInfoTabs';
import { ReviewsSection } from '@/components/product/ReviewsSection';
import { RecentlyViewed } from '@/components/product/RecentlyViewed';
import { ProductCard } from '@/components/product/ProductCard';

type Params = Promise<{ category: string; slug: string }>;

async function load(slug: string) {
  try {
    return await catalog.product(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

const absolute = (url: string) => (url.startsWith('http') ? url : `${SITE.url}${url}`);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await load((await params).slug);
  const title = p.metaTitle ?? `${p.name} — Buy Online`;
  const description = p.metaDescription ?? p.shortDescription ?? p.description.slice(0, 155);
  const url = `/products/${p.category.slug}/${p.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: `${p.name} | Kashif Collection`, description, url, images: p.images.slice(0, 1).map((i) => ({ url: absolute(i.url), alt: i.altText ?? p.name })) },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { category, slug } = await params;
  const product = await load(slug);
  // Keep a single canonical URL per product.
  if (product.category.slug !== category) permanentRedirect(`/products/${product.category.slug}/${product.slug}`);
  const related = await catalog.related(slug).catch(() => []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    description: product.shortDescription ?? product.description,
    brand: { '@type': 'Brand', name: product.brand },
    image: product.images.map((i) => absolute(i.url)),
    category: product.category.name,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.min(...product.variants.map((v) => v.price)) / 100,
      highPrice: Math.max(...product.variants.map((v) => v.price)) / 100,
      offerCount: product.variants.length,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE.url}/products/${product.category.slug}/${product.slug}`,
      seller: { '@type': 'Organization', name: SITE.name },
    },
    ...(product.ratingCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount } } : {}),
  };

  return (
    <div className="container py-6 pb-28 md:py-10 md:pb-10">
      <Breadcrumbs
        items={[
          { label: product.category.name, href: `/category/${product.category.slug}` },
          ...(product.subcategory ? [{ label: product.subcategory.name, href: `/category/${product.category.slug}/${product.subcategory.slug}` }] : []),
          { label: product.name },
        ]}
      />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <ProductGallery images={product.images} name={product.name} />
        <BuyBox product={product} />
      </div>
      <ProductInfoTabs product={product} />
      <ReviewsSection product={product} />
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-3xl font-semibold">You may also like</h2>
          <div className="no-scrollbar -mx-4 mt-6 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:px-0">
            {related.slice(0, 4).map((p) => (
              <div key={p.id} className="w-[46%] shrink-0 md:w-auto">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}
      <RecentlyViewed excludeId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
