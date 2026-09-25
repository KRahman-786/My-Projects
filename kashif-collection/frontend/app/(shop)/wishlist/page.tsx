'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { wishlistApi } from '@/services/account';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCart } from '@/components/providers/CartProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { ButtonLink } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { Price } from '@/components/ui/Price';
import { errorMessage } from '@/lib/api';
import { productUrl } from '@/utils/format';

export default function WishlistPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { refetch: refetchCart } = useCart();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['wishlist', user?.id], queryFn: wishlistApi.list, enabled: Boolean(user) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['wishlist'] });
    void qc.invalidateQueries({ queryKey: ['wishlist-ids'] });
  };

  if (!authLoading && !user) {
    return (
      <div className="container py-10">
        <EmptyState icon={Heart} title="Save your favourites" description="Log in to build a wishlist that follows you on every device." action={<ButtonLink href="/login?next=/wishlist">Log in</ButtonLink>} />
      </div>
    );
  }

  return (
    <div className="container py-8 md:py-12">
      <h1 className="font-display text-4xl font-semibold">My wishlist</h1>
      <div className="mt-8">
        {q.isLoading || authLoading ? (
          <ProductGridSkeleton count={4} />
        ) : q.isError ? (
          <ErrorState message="Couldn't load your wishlist." onRetry={() => void q.refetch()} />
        ) : !q.data?.length ? (
          <EmptyState icon={Heart} title="Your wishlist is empty" description="Tap the heart on any product to save it here." action={<ButtonLink href="/products">Discover products</ButtonLink>} />
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
            {q.data.map(({ id, product: p }) => (
              <article key={id} className="flex flex-col">
                <Link href={productUrl(p)} className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
                  {p.images[0] && <SmartImage src={p.images[0].url} alt={p.name} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" />}
                  {!p.inStock && <span className="absolute inset-x-0 bottom-0 bg-white/90 py-2 text-center text-xs font-semibold uppercase">Out of stock</span>}
                </Link>
                <Link href={productUrl(p)} className="mt-3 line-clamp-2 text-sm font-medium hover:text-plum-700">
                  {p.name}
                </Link>
                <Price price={p.price} mrp={p.mrp} size="sm" className="mt-1" />
                <div className="mt-3 flex gap-2">
                  {p.defaultVariantId ? (
                    <button
                      disabled={!p.inStock}
                      onClick={() =>
                        void wishlistApi
                          .moveToCart(p.id)
                          .then(() => {
                            toast('Moved to your bag', 'success', { label: 'View bag', href: '/cart' });
                            refresh();
                            refetchCart();
                          })
                          .catch((e) => toast(errorMessage(e), 'error'))
                      }
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-plum-700 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" /> Move to bag
                    </button>
                  ) : (
                    <Link href={productUrl(p)} className="flex h-9 flex-1 items-center justify-center rounded-full border border-plum-700 text-xs font-semibold text-plum-700">
                      Choose option
                    </Link>
                  )}
                  <button
                    onClick={() => void wishlistApi.remove(p.id).then(refresh)}
                    aria-label={`Remove ${p.name} from wishlist`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
