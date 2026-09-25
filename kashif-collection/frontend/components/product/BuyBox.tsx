'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, Zap, ShieldCheck, RotateCcw, BadgeIndianRupee } from 'lucide-react';
import clsx from 'clsx';
import type { ProductDetail } from '@/types';
import { Price } from '@/components/ui/Price';
import { Stars } from '@/components/ui/Stars';
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/components/providers/CartProvider';
import { useWishlist } from '@/components/providers/WishlistProvider';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { PincodeChecker } from './PincodeChecker';

export function BuyBox({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { add } = useCart();
  const { ids, toggle } = useWishlist();
  const { track } = useRecentlyViewed();
  const firstAvailable = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable;

  useEffect(() => track(product.id), [product.id, track]);

  const colors = useMemo(() => product.variants.filter((v) => v.color), [product.variants]);
  const hasOptions = product.variants.length > 1;
  const wished = ids.has(product.id);
  const maxQty = variant?.lowStock ?? 10;

  const addToBag = async (buyNow = false) => {
    if (!variant) return;
    setBusy(buyNow ? 'buy' : 'add');
    const ok = await add(variant.id, qty, product.name);
    setBusy(null);
    if (ok && buyNow) router.push('/checkout');
  };

  return (
    <div className="lg:sticky lg:top-36">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-600">{product.brand}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold leading-tight md:text-[40px]">{product.name}</h1>
      {product.ratingCount > 0 && (
        <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-plum-700">
          <Stars rating={product.ratingAvg} /> <b className="text-ink">{product.ratingAvg.toFixed(1)}</b> · {product.ratingCount} review{product.ratingCount > 1 ? 's' : ''}
        </a>
      )}
      {product.shortDescription && <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{product.shortDescription}</p>}

      <div className="mt-6 border-y border-line py-5">
        {variant && <Price price={variant.price} mrp={variant.mrp} size="lg" />}
        <p className="mt-1 text-xs text-ink-muted">MRP inclusive of all taxes</p>
      </div>

      {hasOptions && (
        <div className="mt-6">
          <p className="mb-3 text-sm">
            <span className="font-semibold">{colors.length ? 'Shade' : 'Option'}:</span> <span className="text-ink-soft">{variant?.name}</span>
          </p>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Choose variant">
            {product.variants.map((v) =>
              v.colorHex && !v.size ? (
                <button
                  key={v.id}
                  role="radio"
                  aria-checked={v.id === variant?.id}
                  aria-label={`${v.name}${v.inStock ? '' : ' (out of stock)'}`}
                  title={v.name}
                  onClick={() => setVariantId(v.id)}
                  className={clsx('relative h-11 w-11 rounded-full border-2 p-0.5 transition', v.id === variant?.id ? 'border-plum-700' : 'border-transparent hover:border-line', !v.inStock && 'opacity-40')}
                >
                  <span className="block h-full w-full rounded-full border border-black/10" style={{ background: v.colorHex }} />
                  {!v.inStock && <span className="absolute left-1/2 top-1/2 h-0.5 w-9 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink/60" />}
                </button>
              ) : (
                <button
                  key={v.id}
                  role="radio"
                  aria-checked={v.id === variant?.id}
                  onClick={() => setVariantId(v.id)}
                  className={clsx(
                    'rounded-xl border px-4 py-2 text-sm transition',
                    v.id === variant?.id ? 'border-plum-700 bg-plum-50 font-semibold text-plum-700' : 'border-line hover:border-plum-300',
                    !v.inStock && 'text-ink-muted line-through',
                  )}
                >
                  {v.name}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        {variant?.inStock ? (
          variant.lowStock ? (
            <p className="text-sm font-semibold text-amber-700">Hurry! Only {variant.lowStock} left in stock</p>
          ) : (
            <p className="text-sm font-medium text-success">In stock · ready to ship</p>
          )
        ) : (
          <p className="text-sm font-semibold text-danger">This option is currently out of stock</p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <QuantitySelector value={qty} onChange={setQty} max={Math.min(10, maxQty)} disabled={!variant?.inStock} />
        <button
          onClick={() => void toggle(product.id, product.name)}
          aria-pressed={wished}
          className="flex h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-medium hover:border-plum-300"
        >
          <Heart className={clsx('h-4 w-4', wished && 'fill-plum-600 text-plum-600')} /> {wished ? 'Wishlisted' : 'Wishlist'}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-[56px] z-30 grid grid-cols-2 gap-2 border-t border-line bg-white p-3 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <Button variant="outline" size="lg" onClick={() => void addToBag(false)} loading={busy === 'add'} disabled={!variant?.inStock}>
          <ShoppingBag className="h-4 w-4" /> Add to bag
        </Button>
        <Button size="lg" onClick={() => void addToBag(true)} loading={busy === 'buy'} disabled={!variant?.inStock}>
          <Zap className="h-4 w-4" /> Buy now
        </Button>
      </div>

      <div className="mt-6">
        <PincodeChecker />
      </div>

      <ul className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-ink-soft">
        <li className="flex flex-col items-center gap-1.5 rounded-xl bg-white p-3">
          <ShieldCheck className="h-5 w-5 text-plum-600" /> 100% genuine
        </li>
        <li className="flex flex-col items-center gap-1.5 rounded-xl bg-white p-3">
          <BadgeIndianRupee className="h-5 w-5 text-plum-600" /> COD available
        </li>
        <li className="flex flex-col items-center gap-1.5 rounded-xl bg-white p-3">
          <RotateCcw className="h-5 w-5 text-plum-600" /> 7-day returns
        </li>
      </ul>
      {variant && <p className="mt-4 text-xs text-ink-muted">SKU: {variant.sku}</p>}
    </div>
  );
}
