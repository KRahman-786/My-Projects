import type { ReactNode } from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { catalog, type ProductQuery } from '@/services/catalog';
import type { Subcategory } from '@/types';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Breadcrumbs, type Crumb } from '@/components/ui/Breadcrumbs';
import { ActiveFilters, FilterPanel, SortSelect } from './FilterPanel';

export type SearchParams = Record<string, string | string[] | undefined>;

const ALLOWED = ['q', 'brand', 'color', 'size', 'minPrice', 'maxPrice', 'rating', 'minDiscount', 'inStock', 'sort', 'page', 'featured', 'bestSeller', 'newArrival'] as const;

export function pickQuery(sp: SearchParams): ProductQuery {
  const q: Record<string, string> = {};
  for (const k of ALLOWED) {
    const v = sp[k];
    if (typeof v === 'string' && v) q[k] = v;
  }
  return q;
}

interface Props {
  title: string;
  description?: ReactNode;
  crumbs: Crumb[];
  basePath: string;
  searchParams: SearchParams;
  fixed?: { category?: string; subcategory?: string };
  subcategories?: Subcategory[];
  categorySlug?: string;
  emptyTitle?: string;
}

/** Server-rendered listing. Filtering, sorting and pagination all happen in the API via query params. */
export async function ProductListing({ title, description, crumbs, basePath, searchParams, fixed, subcategories, categorySlug, emptyTitle }: Props) {
  const query = { ...pickQuery(searchParams), ...fixed, limit: '24' };
  const [result, facets] = await Promise.all([
    catalog.products(query).catch(() => null),
    catalog.facets({ q: query.q, category: fixed?.category, subcategory: fixed?.subcategory }).catch(() => ({ brands: [], colors: [], sizes: [], priceRange: { min: 0, max: 0 } })),
  ]);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams(pickQuery(searchParams) as Record<string, string>);
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="container py-8 md:py-10">
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 border-b border-line pb-6">
        <h1 className="font-display text-4xl font-semibold md:text-5xl">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-sm text-ink-muted md:text-base">{description}</div>}
      </header>

      <div className="mt-6 flex gap-10">
        <FilterPanel facets={facets} subcategories={subcategories} categorySlug={categorySlug} />
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">{result ? `${result.meta?.total ?? 0} products` : ''}</p>
            <SortSelect />
          </div>
          <ActiveFilters />
          {!result ? (
            <ErrorState message="We couldn't load products right now. Please check your connection and refresh." />
          ) : result.data.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={emptyTitle ?? 'No products found'}
              description="Try removing a filter or searching for something else — lipstick, gota lace, jhumka…"
              action={
                <Link href={basePath} className="inline-flex h-11 items-center rounded-full bg-plum-700 px-6 text-sm font-semibold text-white">
                  Clear filters
                </Link>
              }
            />
          ) : (
            <>
              <ProductGrid products={result.data} />
              <Pagination page={result.meta?.page ?? 1} totalPages={result.meta?.totalPages ?? 1} hrefFor={hrefFor} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
