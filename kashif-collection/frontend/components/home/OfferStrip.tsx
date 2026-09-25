'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, Tag } from 'lucide-react';
import type { Offer } from '@/types';
import { formatDate, formatPrice } from '@/utils/format';

export function OfferStrip({ coupons }: { coupons: Offer[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <section className="relative overflow-hidden bg-plum-800 py-14 text-white md:py-20">
      <div aria-hidden className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />
      <div aria-hidden className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-plum-400/20 blur-3xl" />
      <div className="container relative grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow text-gold-300">Offers of the season</p>
          <h2 className="mt-2 font-display text-4xl font-semibold leading-tight md:text-5xl">
            Up to <span className="italic text-gold-300">45% off</span> on festive favourites
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-plum-100">Stack our coupons with already-discounted prices. Offers are validated at checkout — the best price is applied automatically.</p>
          <Link href="/products?minDiscount=30&sort=discount" className="mt-7 inline-flex h-12 items-center rounded-full bg-gold-400 px-8 text-sm font-semibold text-plum-900 transition hover:bg-gold-300">
            Shop the sale
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {coupons.slice(0, 4).map((c) => (
            <div key={c.code} className="relative flex flex-col rounded-2xl border border-dashed border-gold-300/50 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-center gap-2 text-gold-300">
                <Tag className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">{c.type === 'PERCENTAGE' ? `${c.value}% off` : `${formatPrice(c.value)} off`}</span>
              </div>
              <p className="mt-2 flex-1 text-sm text-plum-100">{c.description}</p>
              <p className="mt-1 text-[11px] text-plum-300">
                {c.minCartValue > 0 ? `Min. order ${formatPrice(c.minCartValue)}` : 'No minimum'}
                {c.expiresAt ? ` · Valid till ${formatDate(c.expiresAt)}` : ''}
              </p>
              <button onClick={() => void copy(c.code)} className="mt-4 flex items-center justify-between rounded-xl bg-white px-4 py-2.5 text-left font-mono text-sm font-bold tracking-widest text-plum-800 transition hover:bg-gold-50">
                {c.code}
                {copied === c.code ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-ink-muted" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
