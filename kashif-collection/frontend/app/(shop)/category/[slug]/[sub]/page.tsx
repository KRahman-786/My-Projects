import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catalog } from '@/services/catalog';
import { ApiError } from '@/lib/api';
import { ProductListing, type SearchParams } from '@/components/listing/ProductListing';

type Params = Promise<{ slug: string; sub: string }>;

async function load(slug: string, sub: string) {
  try {
    const c = await catalog.category(slug);
    const s = c.subcategories.find((x) => x.slug === sub);
    if (!s) notFound();
    return { c, s };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, sub } = await params;
  const { c, s } = await load(slug, sub);
  return {
    title: `${s.name} — ${c.name}`,
    description: `Shop ${s.name} in ${c.name} at Kashif Collection. Great prices, COD and fast delivery across India.`,
    alternates: { canonical: `/category/${c.slug}/${s.slug}` },
  };
}

export default async function SubcategoryPage({ params, searchParams }: { params: Params; searchParams: Promise<SearchParams> }) {
  const { slug, sub } = await params;
  const { c, s } = await load(slug, sub);
  return (
    <ProductListing
      title={s.name}
      description={`${c.name} · ${s.name}`}
      crumbs={[{ label: c.name, href: `/category/${c.slug}` }, { label: s.name }]}
      basePath={`/category/${c.slug}/${s.slug}`}
      searchParams={await searchParams}
      fixed={{ category: c.slug, subcategory: s.slug }}
      subcategories={c.subcategories}
      categorySlug={c.slug}
    />
  );
}
