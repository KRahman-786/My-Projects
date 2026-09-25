'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Heart, ShoppingBag, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { ProductCard as TProduct } from '@/types';
import { SmartImage } from '@/components/ui/SmartImage';
import { Price } from '@/components/ui/Price';
import { RatingPill } from '@/components/ui/Stars';
import { useWishlist } from '@/components/providers/WishlistProvider';
import { useCart } from '@/components/providers/CartProvider';
import { productUrl } from '@/utils/format';

export function ProductCard({ product, priority }: { product: TProduct; priority?: boolean }) {
  const { ids, toggle } = useWishlist();
  const { add } = useCart();
  const [adding, setAdding] = useState(false);
  const href = productUrl(product);
  const wished = ids.has(product.id);
  const [img1, img2] = product.images;

  const quickAdd = async () => {
    if (!product.defaultVariantId) return;
    setAdding(true);
    await add(product.defaultVariantId, 1, product.name);
    setAdding(false);
  };

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
        <Link href={href} aria-label={product.name} className="absolute inset-0">
          {img1 && (
            <SmartImage
              src={img1.url}
              alt={img1.altText ?? product.name}
              fill
              priority={priority}
              sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
              className={clsx('object-cover transition duration-700 ease-out group-hover:scale-[1.04]', img2 && 'group-hover:opacity-0')}
            />
          )}
          {img2 && <SmartImage src={img2.url} alt="" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover opacity-0 transition duration-700 group-hover:opacity-100" />}
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col gap-1.5">
          {product.isNewArrival && <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-plum-700">New</span>}
          {product.isBestSeller && <span className="rounded-full bg-gold-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-plum-900">Bestseller</span>}
        </div>

        <button
          onClick={() => void toggle(product.id, product.name)}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wished}
          className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-105"
        >
          <Heart className={clsx('h-[18px] w-[18px]', wished ? 'fill-plum-600 text-plum-600' : 'text-ink-soft')} />
        </button>

        {!product.inStock && (
          <div className="absolute inset-x-0 bottom-0 bg-white/90 py-2 text-center text-xs font-semibold uppercase tracking-wider text-ink-soft">Out of stock</div>
        )}

        {product.inStock && (
          <div className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
            {product.defaultVariantId ? (
              <button onClick={quickAdd} disabled={adding} className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-plum-700/95 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur hover:bg-plum-800">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />} Add to bag
              </button>
            ) : (
              <Link href={href} className="flex h-10 w-full items-center justify-center rounded-full bg-white/95 text-xs font-semibold uppercase tracking-wider text-plum-700 backdrop-blur hover:bg-white">
                Choose {product.colors.length > 1 ? 'shade' : 'option'}
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{product.brand}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-ink md:text-[15px]">
          <Link href={href} className="hover:text-plum-700">
            {product.name}
          </Link>
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          <RatingPill rating={product.ratingAvg} count={product.ratingCount} />
          {product.colors.length > 1 && (
            <span className="flex items-center gap-1" aria-label={`${product.colors.length} shades`}>
              {product.colors.slice(0, 4).map((c) => (
                <span key={c.name} title={c.name} className="h-3 w-3 rounded-full border border-black/10" style={{ background: c.hex ?? '#ddd' }} />
              ))}
              {product.colors.length > 4 && <span className="text-[10px] text-ink-muted">+{product.colors.length - 4}</span>}
            </span>
          )}
        </div>
        <Price price={product.price} mrp={product.mrp} size="sm" className="mt-1.5" />
      </div>
    </article>
  );
}
