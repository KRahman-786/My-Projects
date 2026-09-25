'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MapPin, Truck, CreditCard, Plus, ShieldCheck, Smartphone, Banknote, AlertTriangle, Lock } from 'lucide-react';
import clsx from 'clsx';
import { addresses as addressApi, cartApi, ordersApi, paymentsApi } from '@/services/account';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { AddressForm, AddressText } from '@/components/account/AddressForm';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { CouponBox } from '@/components/cart/CouponBox';
import { CartLine } from '@/components/cart/CartLine';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/EmptyState';
import { Textarea } from '@/components/ui/Field';
import { usePayment } from '@/components/checkout/usePayment';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDate, formatPrice } from '@/utils/format';
import type { PaymentMethod } from '@/types';

const STEPS = [
  { id: 1, label: 'Address', icon: MapPin },
  { id: 2, label: 'Shipping', icon: Truck },
  { id: 3, label: 'Payment', icon: CreditCard },
];

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const { pay, ui: paymentUi } = usePayment();
  const [step, setStep] = useState(1);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);
  const idempotencyKey = useRef(newKey());

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/checkout');
  }, [authLoading, user, router]);

  const addrQ = useQuery({ queryKey: ['addresses'], queryFn: addressApi.list, enabled: Boolean(user) });
  const payCfg = useQuery({ queryKey: ['payment-config'], queryFn: paymentsApi.config, staleTime: 5 * 60_000 });
  const selected = addrQ.data?.find((a) => a.id === addressId) ?? null;

  useEffect(() => {
    if (!addressId && addrQ.data?.length) setAddressId((addrQ.data.find((a) => a.isDefault) ?? addrQ.data[0]!).id);
    if (addrQ.data && addrQ.data.length === 0) setAddingAddress(true);
  }, [addrQ.data, addressId]);

  // Live server quote for the chosen address and payment method (shipping, GST split, COD fee).
  const quoteQ = useQuery({
    queryKey: ['cart', user?.id, 'checkout', selected?.pincode, selected?.state, method],
    queryFn: () => cartApi.get({ pincode: selected?.pincode, state: selected?.state, paymentMethod: method ?? undefined }),
    enabled: Boolean(user),
    placeholderData: (prev) => prev,
  });
  const quote = quoteQ.data;

  const methods = useMemo(
    () =>
      [
        { id: 'RAZORPAY' as const, title: 'UPI, Cards, Wallets & Net Banking', sub: 'Pay securely with Razorpay', icon: Smartphone, enabled: payCfg.data?.razorpay.enabled ?? false },
        { id: 'STRIPE' as const, title: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay via Stripe', icon: CreditCard, enabled: payCfg.data?.stripe.enabled ?? false },
        { id: 'COD' as const, title: 'Cash on Delivery', sub: quote?.cod.available ? `Pay in cash when your order arrives · ${formatPrice(quote.cod.fee)} handling fee` : (quote?.cod.reason ?? 'Checking availability…'), icon: Banknote, enabled: quote?.cod.available ?? false },
      ],
    [payCfg.data, quote],
  );

  if (authLoading || !user || quoteQ.isLoading || addrQ.isLoading) {
    return (
      <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_400px]">
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  if (quoteQ.isError || !quote) return <div className="container py-16"><ErrorState message="We couldn't load your checkout. Please try again." onRetry={() => void quoteQ.refetch()} /></div>;
  if (quote.lines.length === 0) {
    return (
      <div className="container py-16 text-center">
        <p className="font-display text-3xl">Your bag is empty</p>
        <Link href="/products" className="mt-4 inline-block font-semibold text-plum-700">
          Continue shopping →
        </Link>
      </div>
    );
  }

  const blocked = quote.unavailable.length > 0;
  const unserviceable = quote.shipping && !quote.shipping.serviceable;

  const placeOrder = async () => {
    if (!selected || !method) return;
    setPlacing(true);
    setPriceChanged(false);
    try {
      const res = await ordersApi.create({
        addressId: selected.id,
        paymentMethod: method,
        couponCode: quote.coupon?.code ?? null,
        customerNote: note || undefined,
        idempotencyKey: idempotencyKey.current,
        expectedTotal: quote.summary.grandTotal,
      });
      const order = res.data;
      idempotencyKey.current = newKey();
      void qc.invalidateQueries({ queryKey: ['cart'] });
      if (order.paymentMethod === 'COD') {
        router.push(`/checkout/confirmation/${order.orderNumber}`);
        return;
      }
      const outcome = await pay(order);
      void qc.invalidateQueries({ queryKey: ['cart'] });
      if (outcome.status === 'paid' || outcome.status === 'processing') router.push(`/checkout/confirmation/${order.orderNumber}`);
      else {
        toast(outcome.status === 'failed' ? `Payment failed${outcome.message ? `: ${outcome.message}` : ''}. You can retry from your order.` : 'Payment was not completed. Your items are reserved for 30 minutes.', 'error');
        router.push(`/account/orders/${order.orderNumber}`);
      }
    } catch (e) {
      if (e instanceof ApiError && e.errorCode === 'PRICE_CHANGED') {
        setPriceChanged(true);
        await quoteQ.refetch();
      } else if (e instanceof ApiError && ['OUT_OF_STOCK', 'INSUFFICIENT_STOCK', 'PRODUCT_UNAVAILABLE', 'COUPON_EXPIRED', 'COUPON_USAGE_LIMIT', 'COUPON_USER_LIMIT'].includes(e.errorCode)) {
        toast(e.message, 'error');
        await quoteQ.refetch();
      } else {
        toast(errorMessage(e), 'error');
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="container py-8 md:py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold">Checkout</h1>
        <p className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
          <Lock className="h-3.5 w-3.5" /> Secure checkout
        </p>
      </div>

      <ol className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider md:gap-4" aria-label="Checkout progress">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 md:gap-4">
            <span className={clsx('flex items-center gap-2', step >= s.id ? 'text-plum-700' : 'text-ink-muted')} aria-current={step === s.id ? 'step' : undefined}>
              <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full border-2', step > s.id ? 'border-plum-700 bg-plum-700 text-white' : step === s.id ? 'border-plum-700' : 'border-line')}>
                {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-line md:w-16" />}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-10">
        <div className="space-y-5">
          {/* Step 1: Address */}
          <section className="card p-5 md:p-7">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <MapPin className="h-5 w-5 text-plum-600" /> Delivery address
              </h2>
              {step > 1 && (
                <button onClick={() => setStep(1)} className="text-sm font-semibold text-plum-700">
                  Change
                </button>
              )}
            </div>
            {step === 1 ? (
              <div className="mt-5">
                {addingAddress ? (
                  <AddressForm
                    onSaved={(a) => {
                      void qc.invalidateQueries({ queryKey: ['addresses'] });
                      setAddressId(a.id);
                      setAddingAddress(false);
                    }}
                    onCancel={addrQ.data?.length ? () => setAddingAddress(false) : undefined}
                  />
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
                      {addrQ.data?.map((a) => (
                        <label key={a.id} className={clsx('relative cursor-pointer rounded-2xl border-2 p-4 transition', addressId === a.id ? 'border-plum-600 bg-plum-50/40' : 'border-line hover:border-plum-200')}>
                          <input type="radio" name="address" className="sr-only" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                          {a.isDefault && <span className="absolute right-3 top-3 rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gold-700">Default</span>}
                          <AddressText a={a} />
                        </label>
                      ))}
                      <button onClick={() => setAddingAddress(true)} className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-semibold text-plum-700 hover:border-plum-300">
                        <Plus className="h-5 w-5" /> Add new address
                      </button>
                    </div>
                    <Button className="mt-6" disabled={!selected} onClick={() => setStep(2)}>
                      Deliver here
                    </Button>
                  </>
                )}
              </div>
            ) : (
              selected && (
                <div className="mt-3">
                  <AddressText a={selected} />
                </div>
              )
            )}
          </section>

          {/* Step 2: Shipping */}
          <section className={clsx('card p-5 md:p-7', step < 2 && 'opacity-60')}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
                <Truck className="h-5 w-5 text-plum-600" /> Shipping
              </h2>
              {step > 2 && (
                <button onClick={() => setStep(2)} className="text-sm font-semibold text-plum-700">
                  Change
                </button>
              )}
            </div>
            {step >= 2 && (
              <div className="mt-4 space-y-4">
                {unserviceable ? (
                  <p className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-danger">
                    <AlertTriangle className="h-4 w-4" /> Sorry, we don&apos;t deliver to {selected?.pincode} yet. Please choose another address.
                  </p>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl border-2 border-plum-600 bg-plum-50/40 p-4">
                    <div>
                      <p className="font-semibold">Standard delivery</p>
                      {quote.shipping && (
                        <p className="text-sm text-ink-soft">
                          Arrives by <b>{formatDate(quote.shipping.estimatedDeliveryDate, { weekday: 'long', day: 'numeric', month: 'short' })}</b>
                        </p>
                      )}
                    </div>
                    <p className="font-semibold">{quote.summary.shippingFee ? formatPrice(quote.summary.shippingFee) : <span className="text-success">FREE</span>}</p>
                  </div>
                )}
                <ul className="divide-y divide-line">
                  {quote.lines.map((l) => (
                    <CartLine key={l.variantId} line={l} compact />
                  ))}
                </ul>
                {step === 2 && (
                  <>
                    <Textarea label="Order note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="E.g. gift wrap, call before delivery" className="min-h-[80px]" />
                    <Button disabled={Boolean(unserviceable) || blocked} onClick={() => setStep(3)}>
                      Continue to payment
                    </Button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Step 3: Payment */}
          <section className={clsx('card p-5 md:p-7', step < 3 && 'opacity-60')}>
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <CreditCard className="h-5 w-5 text-plum-600" /> Payment
            </h2>
            {step === 3 && (
              <div className="mt-5 space-y-3" role="radiogroup" aria-label="Payment method">
                {methods.map((m) => (
                  <label
                    key={m.id}
                    className={clsx(
                      'flex items-center gap-4 rounded-2xl border-2 p-4 transition',
                      !m.enabled ? 'cursor-not-allowed border-line opacity-50' : method === m.id ? 'cursor-pointer border-plum-600 bg-plum-50/40' : 'cursor-pointer border-line hover:border-plum-200',
                    )}
                  >
                    <input type="radio" name="payment" className="h-4 w-4 accent-plum-700" disabled={!m.enabled} checked={method === m.id} onChange={() => setMethod(m.id)} />
                    <m.icon className="h-6 w-6 text-plum-600" strokeWidth={1.5} />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{m.title}</span>
                      <span className="block text-xs text-ink-muted">{m.enabled || m.id === 'COD' ? m.sub : 'Currently unavailable'}</span>
                    </span>
                  </label>
                ))}
                {priceChanged && (
                  <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Prices or offers changed since you opened checkout. Please review the updated total and place the order again.
                  </p>
                )}
                {blocked && <p className="text-sm text-danger">Some items in your bag are unavailable. Please update your bag first.</p>}
                <Button size="lg" block className="mt-3" disabled={!method || blocked || Boolean(unserviceable)} loading={placing} onClick={() => void placeOrder()}>
                  {method === 'COD' ? `Place order · ${formatPrice(quote.summary.grandTotal)}` : `Pay ${formatPrice(quote.summary.grandTotal)}`}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted">
                  <ShieldCheck className="h-3.5 w-3.5" /> Payments are verified on our server. We never store your card details.
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <CouponBox />
          <OrderSummary summary={quote.summary} couponCode={quote.coupon?.code} title="Order summary" />
          <p className="text-center text-xs text-ink-muted">
            By placing your order you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/return-policy" className="underline">Return Policy</Link>.
          </p>
        </aside>
      </div>
      {paymentUi}
    </div>
  );
}
