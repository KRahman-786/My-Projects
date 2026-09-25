import type { Metadata } from 'next';
import { ProductListing, type SearchParams } from '@/components/listing/ProductListing';

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: q ? `Search results for “${q}”` : 'Search', robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  return (
    <ProductListing
      title={q ? `Results for “${q}”` : 'Search'}
      description={q ? undefined : 'Type in the search bar to find products by name, SKU, category or tag.'}
      crumbs={[{ label: 'Search' }]}
      basePath="/search"
      searchParams={sp}
      emptyTitle={q ? `No results for “${q}”` : 'Start searching'}
    />
  );
}
