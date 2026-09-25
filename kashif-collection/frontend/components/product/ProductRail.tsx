import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ProductCard as TProduct } from '@/types';
import { ProductCard } from './ProductCard';

/** Horizontal scroll on mobile, 4-column grid on desktop. */
export function ProductRail({ eyebrow, title, href, products }: { eyebrow?: string; title: string; href?: string; products: TProduct[] }) {
  if (!products.length) return null;
  return (
    <section className="container py-12 md:py-16">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="section-title mt-2">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="group hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-plum-700 sm:flex">
            View all <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        )}
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0">
        {products.slice(0, 8).map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      {href && (
        <Link href={href} className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-plum-700 sm:hidden">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}
