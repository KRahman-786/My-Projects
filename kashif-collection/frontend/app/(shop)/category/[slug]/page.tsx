import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catalog } from '@/services/catalog';
import { ApiError } from '@/lib/api';
import { ProductListing, type SearchParams } from '@/components/listing/ProductListing';

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  try {
    return await catalog.category(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = await load((await params).slug);
  return {
    title: `${c.name} — Shop Online`,
    description: c.description ?? `Shop ${c.name} online at Kashif Collection.`,
    alternates: { canonical: `/category/${c.slug}` },
    openGraph: { title: `${c.name} | Kashif Collection`, description: c.description ?? undefined, images: c.imageUrl ? [c.imageUrl] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Promise<SearchParams> }) {
  const c = await load((await params).slug);
  return (
    <ProductListing
      title={c.name}
      description={c.description}
      crumbs={[{ label: c.name }]}
      basePath={`/category/${c.slug}`}
      searchParams={await searchParams}
      fixed={{ category: c.slug }}
      subcategories={c.subcategories}
      categorySlug={c.slug}
    />
  );
}
