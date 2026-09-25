import Link from 'next/link';
import { BadgeCheck, Quote } from 'lucide-react';
import type { Review } from '@/types';
import { Stars } from '@/components/ui/Stars';

export function Testimonials({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return null;
  return (
    <section className="bg-sand/60 py-14 md:py-20">
      <div className="container">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="eyebrow">Loved by our customers</p>
          <h2 className="section-title mt-2">Real reviews, real smiles</h2>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
          {reviews.slice(0, 6).map((r) => (
            <figure key={r.id} className="card relative w-[82%] shrink-0 snap-start p-6 md:w-auto">
              <Quote className="absolute right-5 top-5 h-8 w-8 text-gold-200" />
              <Stars rating={r.rating} />
              {r.title && <p className="mt-3 font-display text-lg font-semibold">{r.title}</p>}
              <blockquote className="mt-2 line-clamp-4 text-sm leading-relaxed text-ink-soft">“{r.body}”</blockquote>
              <figcaption className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  {r.author}
                  {r.isVerifiedPurchase && <BadgeCheck className="h-4 w-4 text-success" aria-label="Verified purchase" />}
                </span>
                {r.product && (
                  <Link href={`/products/${r.product.category.slug}/${r.product.slug}`} className="line-clamp-1 max-w-[55%] text-right text-plum-700 hover:underline">
                    {r.product.name}
                  </Link>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
