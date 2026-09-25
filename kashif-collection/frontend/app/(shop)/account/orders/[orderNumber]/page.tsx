'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Truck, CreditCard, MapPin, RotateCcw, XCircle, Star, ExternalLink } from 'lucide-react';
import { ordersApi } from '@/services/account';
import { OrderTimeline } from '@/components/account/OrderTimeline';
import { AddressText } from '@/components/account/AddressForm';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { SmartImage } from '@/components/ui/SmartImage';
import { ReviewForm } from '@/components/product/ReviewForm';
import { usePayment } from '@/components/checkout/usePayment';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatPrice, ORDER_STATUS_LABEL } from '@/utils/format';
import type { OrderItem } from '@/types';

const CANCEL_REASONS = ['Changed my mind', 'Ordered by mistake', 'Found a better price', 'Delivery is taking too long', 'Want to change address / items', 'Other'];
const RETURN_REASONS = ['Product damaged', 'Wrong item received', 'Colour / shade different from picture', 'Quality not as expected', 'Size / fit issue', 'Other'];

export default function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  const { pay, ui: paymentUi } = usePayment();
  const q = useQuery({ queryKey: ['order', orderNumber], queryFn: () => ordersApi.get(orderNumber) });
  const [modal, setModal] = useState<'cancel' | 'return' | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);

  if (q.isLoading) return <Spinner label="Loading order…" />;
  if (q.isError || !q.data) return <ErrorState message="Order not found." />;
  const o = q.data;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['order', orderNumber] });
    void qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (modal === 'cancel') await ordersApi.cancel(orderNumber, reason || CANCEL_REASONS[0]!);
      else await ordersApi.requestReturn(orderNumber, reason || RETURN_REASONS[0]!, details || undefined);
      toast(modal === 'cancel' ? 'Your order has been cancelled' : 'Return requested. We will contact you shortly.');
      setModal(null);
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const payNow = async () => {
    setBusy(true);
    try {
      const outcome = await pay(o);
      if (outcome.status === 'paid') toast('Payment successful!');
      else if (outcome.status === 'failed') toast(`Payment failed${outcome.message ? `: ${outcome.message}` : ''}`, 'error');
      else if (outcome.status === 'processing') toast('Payment is being confirmed…', 'info');
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const invoiceAvailable = !['PENDING', 'CANCELLED'].includes(o.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/account/orders" className="text-sm text-ink-muted hover:text-plum-700">
            ← All orders
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            Order <span className="font-mono text-2xl md:text-3xl">{o.orderNumber}</span>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Placed on {formatDateTime(o.placedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(o.status)} className="text-xs">
            {ORDER_STATUS_LABEL[o.status]}
          </Badge>
          <Badge tone={statusTone(o.paymentStatus)} className="text-xs">
            Payment: {o.paymentStatus.toLowerCase()}
          </Badge>
        </div>
      </div>

      {o.canPay && (
        <div className="card flex flex-col gap-3 border-amber-200 bg-amber-50 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-amber-900">{o.paymentStatus === 'FAILED' ? 'Your last payment attempt failed' : 'Payment pending'}</p>
            <p className="text-sm text-amber-800">
              Complete payment {o.reservationExpiresAt ? `before ${formatDateTime(o.reservationExpiresAt)}` : 'soon'} to confirm your order — items are reserved for you until then.
            </p>
          </div>
          <Button onClick={() => void payNow()} loading={busy}>
            <CreditCard className="h-4 w-4" /> Pay {formatPrice(o.grandTotal)}
          </Button>
        </div>
      )}

      <section className="card p-5 md:p-7">
        <h2 className="mb-5 flex items-center gap-2 font-semibold">
          <Truck className="h-4 w-4 text-plum-600" /> Order status
        </h2>
        <OrderTimeline order={o} />
        {o.trackingNumber && (
          <p className="mt-5 rounded-xl bg-ivory p-4 text-sm">
            Tracking number: <b className="font-mono">{o.trackingNumber}</b>
            {o.trackingUrl && (
              <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-3 inline-flex items-center gap-1 font-semibold text-plum-700">
                Track shipment <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </p>
        )}
        {o.estimatedDeliveryDate && !['DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED'].includes(o.status) && (
          <p className="mt-4 text-sm text-ink-soft">
            Estimated delivery: <b>{formatDate(o.estimatedDeliveryDate, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
          </p>
        )}
        {o.cancelReason && <p className="mt-4 text-sm text-danger">Cancellation reason: {o.cancelReason}</p>}
      </section>

      <section className="card p-5 md:p-7">
        <h2 className="font-semibold">Items</h2>
        <ul className="mt-2 divide-y divide-line">
          {o.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-4">
              <Link href={`/products/shop/${i.productSlug}`} className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-sand">
                {i.imageUrl && <SmartImage src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
              </Link>
              <div className="flex-1 text-sm">
                <p className="font-medium">{i.productName}</p>
                <p className="text-xs text-ink-muted">
                  {i.variantName !== 'Standard' ? `${i.variantName} · ` : ''}SKU {i.sku} · Qty {i.quantity}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {formatPrice(i.unitPrice)} each {i.mrp > i.unitPrice && <span className="line-through">{formatPrice(i.mrp)}</span>} · GST {i.gstRate}%
                </p>
                {o.canReview &&
                  (i.review ? (
                    <p className="mt-2 flex items-center gap-1 text-xs text-success">
                      <Star className="h-3.5 w-3.5 fill-current" /> You rated this {i.review.rating}★
                    </p>
                  ) : (
                    <button onClick={() => setReviewItem(i)} className="mt-2 text-xs font-semibold text-plum-700 hover:underline">
                      Rate &amp; review
                    </button>
                  ))}
              </div>
              <p className="text-sm font-semibold">{formatPrice(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-5 md:p-7">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-plum-600" /> Shipping address
          </h2>
          <AddressText
            a={{ name: o.shipName, phone: o.shipPhone, house: o.shipHouse, street: o.shipStreet, area: o.shipArea, landmark: o.shipLandmark, city: o.shipCity, state: o.shipState, pincode: o.shipPincode }}
          />
        </section>
        <section className="card p-5 md:p-7">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <CreditCard className="h-4 w-4 text-plum-600" /> Payment
          </h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Total MRP</dt>
              <dd>{formatPrice(o.mrpTotal)}</dd>
            </div>
            {o.productDiscount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd>− {formatPrice(o.productDiscount)}</dd>
              </div>
            )}
            {o.couponDiscount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Coupon ({o.couponCode})</dt>
                <dd>− {formatPrice(o.couponDiscount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-muted">Shipping</dt>
              <dd>{o.shippingFee ? formatPrice(o.shippingFee) : 'FREE'}</dd>
            </div>
            {o.codFee > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-muted">COD fee</dt>
                <dd>{formatPrice(o.codFee)}</dd>
              </div>
            )}
            <div className="flex justify-between text-xs text-ink-muted">
              <dt>GST {o.taxInclusive ? '(included)' : ''}</dt>
              <dd>{o.igst ? `IGST ${formatPrice(o.igst)}` : `CGST ${formatPrice(o.cgst)} + SGST ${formatPrice(o.sgst)}`}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatPrice(o.grandTotal)}</dd>
            </div>
            <div className="pt-1 text-xs text-ink-muted">Paid via {o.paymentMethod === 'COD' ? 'Cash on Delivery' : o.paymentMethod === 'RAZORPAY' ? 'Razorpay' : 'Card (Stripe)'}</div>
          </dl>
        </section>
      </div>

      {(o.refunds.length > 0 || o.returns.length > 0) && (
        <section className="card p-5 md:p-7">
          <h2 className="mb-3 font-semibold">Returns &amp; refunds</h2>
          <ul className="space-y-2 text-sm">
            {o.returns.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span>
                  Return: {r.reason} {r.adminNote && <span className="text-ink-muted">— {r.adminNote}</span>}
                </span>
                <Badge tone={statusTone(r.status)}>{r.status.toLowerCase()}</Badge>
              </li>
            ))}
            {o.refunds.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span>
                  Refund of <b>{formatPrice(r.amount)}</b> {r.processedAt && <span className="text-ink-muted">on {formatDate(r.processedAt)}</span>}
                </span>
                <Badge tone={statusTone(r.status)}>{r.status.toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {invoiceAvailable && (
          <a href={ordersApi.invoiceUrl(o.orderNumber)} className="inline-flex h-11 items-center gap-2 rounded-full border border-plum-700 px-6 text-sm font-semibold text-plum-700 hover:bg-plum-700 hover:text-white">
            <Download className="h-4 w-4" /> Download invoice
          </a>
        )}
        {o.canCancel && (
          <Button
            variant="ghost"
            onClick={() => {
              setReason(CANCEL_REASONS[0]!);
              setModal('cancel');
            }}
          >
            <XCircle className="h-4 w-4" /> Cancel order
          </Button>
        )}
        {o.canReturn && (
          <Button
            variant="ghost"
            onClick={() => {
              setReason(RETURN_REASONS[0]!);
              setModal('return');
            }}
          >
            <RotateCcw className="h-4 w-4" /> Return / refund
          </Button>
        )}
      </div>
      {o.canReturn && o.returnDeadline && <p className="text-xs text-ink-muted">Return window closes on {formatDate(o.returnDeadline)}.</p>}

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'cancel' ? 'Cancel order' : 'Request a return'}>
        <div className="space-y-4">
          <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {(modal === 'cancel' ? CANCEL_REASONS : RETURN_REASONS).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          {modal === 'return' && <Textarea label="Tell us more (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />}
          <p className="text-xs text-ink-muted">
            {modal === 'cancel'
              ? o.paymentStatus === 'PAID'
                ? 'A full refund will be issued to your original payment method within 5–7 business days.'
                : 'Your order will be cancelled immediately.'
              : 'Once we receive the item, your refund (excluding shipping/COD fees) will be processed within 5–7 business days.'}
          </p>
          <Button block variant={modal === 'cancel' ? 'danger' : 'primary'} loading={busy} onClick={() => void submit()}>
            {modal === 'cancel' ? 'Confirm cancellation' : 'Submit return request'}
          </Button>
        </div>
      </Modal>
      <Modal open={reviewItem !== null} onClose={() => setReviewItem(null)} title={`Review ${reviewItem?.productName ?? ''}`}>
        {reviewItem && (
          <ReviewForm
            productId={reviewItem.productId}
            orderItemId={reviewItem.id}
            onDone={() => {
              setReviewItem(null);
              refresh();
            }}
          />
        )}
      </Modal>
      {paymentUi}
    </div>
  );
}
