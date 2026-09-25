import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ProductCard as TProduct } from '@/types';
import { ProductCard } from '@/components/product/ProductCard';
import { SmartImage } from '@/components/ui/SmartImage';
import clsx from 'clsx';

/** Editorial banner + 3 products for one category. */
export function CategorySpotlight({
  eyebrow,
  title,
  copy,
  href,
  image,
  products,
  reverse,
  tone = 'blush',
}: {
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  image: string;
  products: TProduct[];
  reverse?: boolean;
  tone?: 'blush' | 'sand' | 'plum';
}) {
  if (!products.length) return null;
  return (
    <section className="container py-10 md:py-14">
      <div className={clsx('grid gap-6 lg:gap-10', reverse ? 'lg:grid-cols-[1.6fr_1fr] lg:[&>*:first-child]:order-2' : 'lg:grid-cols-[1fr_1.6fr]')}>
        <div className={clsx('relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded-[28px] p-7 md:p-10', tone === 'plum' ? 'bg-plum-800 text-white' : tone === 'sand' ? 'bg-sand' : 'bg-blush')}>
          <SmartImage src={image} alt="" fill sizes="(min-width:1024px) 40vw, 100vw" className="object-cover opacity-90" />
          <div className={clsx('absolute inset-0', tone === 'plum' ? 'bg-gradient-to-t from-plum-900/90 via-plum-900/40 to-transparent' : 'bg-gradient-to-t from-white/95 via-white/60 to-transparent')} />
          <div className="relative">
            <p className={clsx('eyebrow', tone === 'plum' && 'text-gold-300')}>{eyebrow}</p>
            <h2 className={clsx('mt-2 font-display text-4xl font-semibold leading-tight', tone !== 'plum' && 'text-ink')}>{title}</h2>
            <p className={clsx('mt-3 max-w-sm text-sm leading-relaxed', tone === 'plum' ? 'text-plum-100' : 'text-ink-soft')}>{copy}</p>
            <Link href={href} className={clsx('mt-6 inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold transition', tone === 'plum' ? 'bg-gold-400 text-plum-900 hover:bg-gold-300' : 'bg-plum-700 text-white hover:bg-plum-800')}>
              Explore <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0">
          {products.slice(0, 3).map((p) => (
            <div key={p.id} className="w-[46%] shrink-0 snap-start md:w-auto">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
