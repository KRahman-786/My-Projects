'use client';

import { useQuery } from '@tanstack/react-query';
import { catalog } from '@/services/catalog';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { ProductCard } from './ProductCard';

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const { ids } = useRecentlyViewed();
  const list = ids.filter((i) => i !== excludeId).slice(0, 8);
  const { data } = useQuery({
    queryKey: ['recently-viewed', list],
    queryFn: () => catalog.products({ ids: list.join(','), limit: '8' }),
    enabled: list.length > 0,
    staleTime: 60_000,
  });
  const products = (data?.data ?? []).sort((a, b) => list.indexOf(a.id) - list.indexOf(b.id));
  if (!products.length) return null;
  return (
    <section className="mt-16">
      <h2 className="font-display text-3xl font-semibold">Recently viewed</h2>
      <div className="no-scrollbar -mx-4 mt-6 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:px-0">
        {products.slice(0, 4).map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
