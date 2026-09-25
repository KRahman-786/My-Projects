'use client';

import Link from 'next/link';
import { Trash2, AlertTriangle } from 'lucide-react';
import type { QuoteLine } from '@/types';
import { SmartImage } from '@/components/ui/SmartImage';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { Price } from '@/components/ui/Price';
import { formatPrice } from '@/utils/format';
import { useCart } from '@/components/providers/CartProvider';

const ISSUE: Record<string, string> = {
  UNAVAILABLE: 'No longer available',
  OUT_OF_STOCK: 'Out of stock',
  INSUFFICIENT_STOCK: 'Not enough stock',
};

export function CartLine({ line, compact }: { line: QuoteLine; compact?: boolean }) {
  const { setQuantity, remove, isFetching } = useCart();
  const key = line.itemId ?? line.variantId;
  const href = `/products/${line.categorySlug}/${line.slug}`;
  return (
    <li className="flex gap-4 py-5">
      <Link href={href} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-sand md:h-28 md:w-24">
        {line.image && <SmartImage src={line.image} alt={line.name} fill sizes="96px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link href={href} className="line-clamp-2 text-sm font-medium hover:text-plum-700 md:text-[15px]">
              {line.name}
            </Link>
            {line.variantName !== 'Standard' && <p className="mt-0.5 text-xs text-ink-muted">{line.variantName}</p>}
          </div>
          {!compact && (
            <button onClick={() => void remove(key)} aria-label={`Remove ${line.name}`} className="h-8 w-8 shrink-0 rounded-full p-1.5 text-ink-muted hover:bg-sand hover:text-danger">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {line.issue ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {ISSUE[line.issue]}
            {line.issue === 'INSUFFICIENT_STOCK' && line.available > 0 && (
              <button onClick={() => void setQuantity(key, line.available)} className="ml-1 underline">
                Set quantity to {line.available}
              </button>
            )}
          </p>
        ) : (
          <Price price={line.unitPrice} mrp={line.mrp} size="sm" className="mt-1.5" />
        )}
        <div className="mt-auto flex items-end justify-between pt-3">
          {compact ? (
            <span className="text-xs text-ink-muted">Qty {line.quantity}</span>
          ) : (
            !line.issue && <QuantitySelector size="sm" value={line.quantity} max={Math.max(1, line.maxQuantity)} disabled={isFetching} onChange={(q) => void setQuantity(key, q)} />
          )}
          {!line.issue && <span className="text-sm font-semibold">{formatPrice(line.lineTotal)}</span>}
        </div>
      </div>
    </li>
  );
}
