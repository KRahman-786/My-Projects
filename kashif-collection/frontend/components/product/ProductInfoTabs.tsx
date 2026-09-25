'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { ProductDetail } from '@/types';

export function ProductInfoTabs({ product }: { product: ProductDetail }) {
  const tabs = [
    { id: 'description', label: 'Description', show: true },
    { id: 'specs', label: 'Specifications', show: product.specifications.length > 0 },
    { id: 'ingredients', label: 'Ingredients', show: Boolean(product.ingredients) },
    { id: 'how', label: 'How to use', show: Boolean(product.howToUse) },
  ].filter((t) => t.show);
  const [active, setActive] = useState(tabs[0]!.id);

  return (
    <section className="mt-14 md:mt-20">
      <div className="no-scrollbar flex gap-6 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={clsx('shrink-0 border-b-2 pb-3 text-sm font-semibold uppercase tracking-[0.12em] transition', active === t.id ? 'border-plum-700 text-plum-700' : 'border-transparent text-ink-muted hover:text-ink')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="py-8" role="tabpanel">
        {active === 'description' && (
          <div className="prose-kc max-w-3xl whitespace-pre-line">
            <p>{product.description}</p>
            {product.tags.length > 0 && (
              <p className="not-prose mt-6 flex flex-wrap gap-2">
                {product.tags.map((t) => (
                  <a key={t} href={`/search?q=${encodeURIComponent(t)}`} className="rounded-full bg-sand px-3 py-1 text-xs text-ink-soft hover:bg-blush">
                    #{t}
                  </a>
                ))}
              </p>
            )}
          </div>
        )}
        {active === 'specs' && (
          <dl className="grid max-w-3xl overflow-hidden rounded-2xl border border-line sm:grid-cols-2">
            {product.specifications.map((s) => (
              <div key={s.label} className="flex gap-4 border-b border-line px-5 py-3.5 text-sm odd:bg-white even:bg-ivory sm:[&:nth-last-child(-n+2)]:border-b-0">
                <dt className="w-40 shrink-0 text-ink-muted">{s.label}</dt>
                <dd className="font-medium text-ink">{s.value}</dd>
              </div>
            ))}
            <div className="flex gap-4 px-5 py-3.5 text-sm">
              <dt className="w-40 shrink-0 text-ink-muted">GST</dt>
              <dd className="font-medium">{product.gstRate}% (included in price)</dd>
            </div>
          </dl>
        )}
        {active === 'ingredients' && <p className="max-w-3xl text-sm leading-relaxed text-ink-soft">{product.ingredients}</p>}
        {active === 'how' && <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-soft">{product.howToUse}</p>}
      </div>
    </section>
  );
}
