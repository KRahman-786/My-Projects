import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Category } from '@/types';
import { SmartImage } from '@/components/ui/SmartImage';

export function CategoryShowcase({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="container py-14 md:py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <p className="eyebrow">Shop by category</p>
        <h2 className="section-title mt-2">Three worlds of beauty</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {categories.map((c) => (
          <div key={c.id} className="group card overflow-hidden">
            <Link href={`/category/${c.slug}`} className="relative block aspect-[5/4] overflow-hidden bg-sand">
              {c.imageUrl && <SmartImage src={c.imageUrl} alt={c.name} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />}
              <span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-plum-700 transition group-hover:bg-plum-700 group-hover:text-white">
                <ArrowUpRight className="h-5 w-5" />
              </span>
            </Link>
            <div className="p-5 md:p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-2xl font-semibold">
                  <Link href={`/category/${c.slug}`}>{c.name}</Link>
                </h3>
                <span className="text-xs text-ink-muted">{c.productCount ?? 0} products</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{c.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {c.subcategories.slice(0, 4).map((s) => (
                  <Link key={s.id} href={`/category/${c.slug}/${s.slug}`} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition hover:border-plum-300 hover:text-plum-700">
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
