'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Package, ChevronRight } from 'lucide-react';
import { ordersApi } from '@/services/account';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge, statusTone } from '@/components/ui/Badge';
import { ButtonLink, Button } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { formatDate, formatPrice, ORDER_STATUS_LABEL } from '@/utils/format';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['orders', page], queryFn: () => ordersApi.list(page), placeholderData: (p) => p });

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">My orders</h1>
      <div className="mt-6">
        {q.isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState message="Couldn't load your orders." onRetry={() => void q.refetch()} />
        ) : !q.data?.data.length ? (
          <EmptyState icon={Package} title="No orders yet" description="When you place an order, it will appear here so you can track it." action={<ButtonLink href="/products">Start shopping</ButtonLink>} />
        ) : (
          <>
            <ul className="space-y-4">
              {q.data.data.map((o) => (
                <li key={o.orderNumber}>
                  <Link href={`/account/orders/${o.orderNumber}`} className="card group flex flex-col gap-4 p-5 transition hover:shadow-lift md:flex-row md:items-center">
                    <div className="flex -space-x-3">
                      {o.items.slice(0, 3).map((i, idx) => (
                        <span key={idx} className="relative h-16 w-14 overflow-hidden rounded-xl border-2 border-white bg-sand">
                          {i.imageUrl && <SmartImage src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                        </span>
                      ))}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{o.orderNumber}</span>
                        <Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                        {o.paymentStatus === 'FAILED' && o.status === 'PENDING' && <Badge tone="red">Payment failed</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{o.items.map((i) => i.productName).join(', ')}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Placed {formatDate(o.placedAt)} · {o.items.reduce((s, i) => s + i.quantity, 0)} item(s)
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 md:flex-col md:items-end">
                      <span className="font-semibold">{formatPrice(o.grandTotal)}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-plum-700">
                        Details <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {q.data.meta && q.data.meta.totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-3">
                <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="self-center text-sm text-ink-muted">
                  Page {page} of {q.data.meta.totalPages}
                </span>
                <Button variant="ghost" disabled={page >= q.data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
