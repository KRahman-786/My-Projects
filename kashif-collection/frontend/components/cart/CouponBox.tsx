'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tag, X } from 'lucide-react';
import { catalog } from '@/services/catalog';
import { useCart } from '@/components/providers/CartProvider';
import { formatPrice } from '@/utils/format';

export function CouponBox() {
  const { quote, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { data: offers } = useQuery({ queryKey: ['offers'], queryFn: catalog.offers, staleTime: 5 * 60_000 });

  const apply = async (c: string) => {
    if (!c.trim()) return;
    setBusy(true);
    const ok = await applyCoupon(c.trim().toUpperCase());
    setBusy(false);
    if (ok) setCode('');
  };

  if (quote?.coupon) {
    return (
      <div className="card flex items-center justify-between gap-3 border-dashed border-success/40 bg-emerald-50/50 p-4">
        <div className="flex items-center gap-3">
          <Tag className="h-5 w-5 text-success" />
          <div>
            <p className="text-sm font-semibold">
              <span className="font-mono tracking-wider">{quote.coupon.code}</span> applied
            </p>
            <p className="text-xs text-success">You saved {formatPrice(quote.coupon.discount)}</p>
          </div>
        </div>
        <button onClick={() => void removeCoupon()} className="flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-danger">
          <X className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void apply(code);
        }}
        className="flex gap-2"
      >
        <label htmlFor="coupon" className="sr-only">
          Coupon code
        </label>
        <input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter coupon code" className="h-11 flex-1 rounded-full border border-line px-4 font-mono text-sm uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal" />
        <button disabled={busy || !code} className="h-11 rounded-full bg-plum-700 px-5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? '…' : 'Apply'}
        </button>
      </form>
      {quote?.couponError && <p className="mt-2 text-xs text-danger">{quote.couponError.message}</p>}
      {offers && offers.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-plum-700">
            {showAll ? 'Hide offers' : `View ${offers.length} available offers`}
          </button>
          {showAll && (
            <ul className="mt-3 space-y-2">
              {offers.map((o) => (
                <li key={o.code} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line p-3">
                  <div>
                    <p className="font-mono text-sm font-bold tracking-wider text-plum-700">{o.code}</p>
                    <p className="text-xs text-ink-muted">{o.description}</p>
                  </div>
                  <button onClick={() => void apply(o.code)} className="shrink-0 text-xs font-semibold text-plum-700 hover:underline">
                    Apply
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
