'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { BadgeCheck, MessageSquareText } from 'lucide-react';
import { catalog } from '@/services/catalog';
import { Stars } from '@/components/ui/Stars';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDate } from '@/utils/format';
import type { ProductDetail } from '@/types';
import { ReviewForm } from './ReviewForm';

export function ReviewsSection({ product }: { product: ProductDetail }) {
  const { user } = useAuth();
  const [sort, setSort] = useState('recent');
  const [writing, setWriting] = useState(false);
  const q = useInfiniteQuery({
    queryKey: ['reviews', product.slug, sort],
    queryFn: ({ pageParam }) => catalog.reviews(product.slug, pageParam, sort),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta && last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
  const reviews = q.data?.pages.flatMap((p) => p.data.items) ?? [];
  const total = product.ratingCount;

  return (
    <section id="reviews" className="scroll-mt-40 border-t border-line pt-12">
      <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold">Customer reviews</h2>
          <div className="mt-5 flex items-center gap-4">
            <span className="font-display text-5xl font-semibold text-plum-700">{total ? product.ratingAvg.toFixed(1) : '–'}</span>
            <div>
              <Stars rating={product.ratingAvg} size={18} />
              <p className="mt-1 text-sm text-ink-muted">Based on {total} review{total === 1 ? '' : 's'}</p>
            </div>
          </div>
          <ul className="mt-6 space-y-2">
            {product.ratingBreakdown.map((r) => (
              <li key={r.rating} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-ink-soft">{r.rating}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                  <span className="block h-full rounded-full bg-gold-400" style={{ width: `${total ? (r.count / total) * 100 : 0}%` }} />
                </span>
                <span className="w-6 text-right text-xs text-ink-muted">{r.count}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {user ? (
              <Button variant="outline" block onClick={() => setWriting(true)}>
                Write a review
              </Button>
            ) : (
              <Link href={`/login?next=/products/${product.category.slug}/${product.slug}`} className="text-sm font-semibold text-plum-700 underline-offset-4 hover:underline">
                Log in to write a review
              </Link>
            )}
            <p className="mt-3 text-xs text-ink-muted">Reviews from delivered orders are marked “Verified Purchase”.</p>
          </div>
        </div>

        <div>
          <div className="mb-4 flex justify-end">
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort reviews" className="h-9 rounded-full border border-line bg-white px-4 text-sm">
              <option value="recent">Most recent</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </select>
          </div>
          {q.isLoading ? (
            <div className="space-y-4">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : q.isError ? (
            <p className="text-sm text-danger">Could not load reviews.</p>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-white py-12 text-center">
              <MessageSquareText className="h-8 w-8 text-plum-300" />
              <p className="mt-3 font-medium">No reviews yet</p>
              <p className="text-sm text-ink-muted">Be the first to share your experience.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <Stars rating={r.rating} />
                    <span className="text-xs text-ink-muted">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{r.body}</p>
                  {r.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="Customer photo" loading="lazy" className="mt-3 h-24 w-24 rounded-xl object-cover" />
                  )}
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                    {r.author}
                    {r.isVerifiedPurchase && (
                      <span className="flex items-center gap-1 text-success">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified Purchase
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {q.hasNextPage && (
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
                Load more reviews
              </Button>
            </div>
          )}
        </div>
      </div>
      <Modal open={writing} onClose={() => setWriting(false)} title="Write a review">
        <ReviewForm
          productId={product.id}
          onDone={() => {
            setWriting(false);
            void q.refetch();
          }}
        />
      </Modal>
    </section>
  );
}
