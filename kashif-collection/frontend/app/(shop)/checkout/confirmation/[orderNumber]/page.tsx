'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle, Package } from 'lucide-react';
import { ordersApi } from '@/services/account';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { formatDate, formatPrice } from '@/utils/format';
import { SmartImage } from '@/components/ui/SmartImage';

export default function ConfirmationPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const q = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: () => ordersApi.get(orderNumber),
    // While an online payment is still being confirmed by the gateway webhook, poll briefly.
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' && query.state.data.paymentStatus !== 'FAILED' && query.state.dataUpdateCount < 12 ? 5000 : false),
  });

  useEffect(() => window.scrollTo(0, 0), []);

  if (q.isLoading) return <Spinner label="Confirming your order…" />;
  if (q.isError || !q.data) return <div className="container py-16"><ErrorState message="We couldn't find this order." /></div>;

  const o = q.data;
  const confirmed = ['CONFIRMED', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status);
  const failed = o.status === 'CANCELLED' || o.paymentStatus === 'FAILED';

  return (
    <div className="container max-w-3xl py-12 md:py-16">
      <div className="card overflow-hidden text-center">
        <div className={confirmed ? 'bg-gradient-to-br from-emerald-50 to-gold-50 px-6 py-10' : failed ? 'bg-red-50 px-6 py-10' : 'bg-amber-50 px-6 py-10'}>
          {confirmed ? (
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" strokeWidth={1.4} />
          ) : failed ? (
            <XCircle className="mx-auto h-16 w-16 text-danger" strokeWidth={1.4} />
          ) : (
            <Clock className="mx-auto h-16 w-16 text-amber-600" strokeWidth={1.4} />
          )}
          <h1 className="mt-4 font-display text-4xl font-semibold">
            {confirmed ? 'Thank you! Your order is confirmed' : failed ? 'Payment not completed' : 'Confirming your payment…'}
          </h1>
          <p className="mt-2 text-ink-soft">
            Order <b className="font-mono">{o.orderNumber}</b> · {formatPrice(o.grandTotal)} · {o.paymentMethod === 'COD' ? 'Cash on Delivery' : o.paymentMethod === 'RAZORPAY' ? 'Razorpay' : 'Card'}
          </p>
          {!confirmed && !failed && <p className="mt-3 text-sm text-ink-muted">This usually takes a few seconds. You can safely leave this page — we&apos;ll update your order automatically.</p>}
          {failed && o.canPay && <p className="mt-3 text-sm text-ink-muted">Your items are still reserved. You can retry the payment from your order page.</p>}
        </div>
        <div className="p-6 text-left md:p-8">
          {o.estimatedDeliveryDate && confirmed && (
            <p className="mb-5 flex items-center gap-2 rounded-xl bg-ivory p-4 text-sm">
              <Package className="h-4 w-4 text-plum-600" /> Estimated delivery by <b>{formatDate(o.estimatedDeliveryDate, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            </p>
          )}
          <ul className="divide-y divide-line">
            {o.items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 py-3">
                <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-sand">{i.imageUrl && <SmartImage src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" />}</span>
                <span className="flex-1 text-sm">
                  <span className="font-medium">{i.productName}</span>
                  <span className="block text-xs text-ink-muted">
                    {i.variantName !== 'Standard' ? `${i.variantName} · ` : ''}Qty {i.quantity}
                  </span>
                </span>
                <span className="text-sm font-semibold">{formatPrice(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/account/orders/${o.orderNumber}`}>{failed && o.canPay ? 'Retry payment' : 'View order'}</ButtonLink>
            <ButtonLink href="/products" variant="outline">
              Continue shopping
            </ButtonLink>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Questions? <Link href="/contact" className="font-semibold text-plum-700">Contact us</Link>
      </p>
    </div>
  );
}
