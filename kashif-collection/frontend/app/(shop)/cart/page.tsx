'use client';

import Link from 'next/link';
import { ShoppingBag, Truck, ShieldCheck } from 'lucide-react';
import { useCart } from '@/components/providers/CartProvider';
import { CartLine } from '@/components/cart/CartLine';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { CouponBox } from '@/components/cart/CouponBox';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ButtonLink } from '@/components/ui/Button';
import { formatPrice } from '@/utils/format';

export default function CartPage() {
  const { quote, isLoading, isError, refetch, count } = useCart();

  if (isLoading) {
    return (
      <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError) return <div className="container py-16"><ErrorState message="We couldn't load your bag. Check your connection and try again." onRetry={refetch} /></div>;

  if (!quote || count === 0 || (quote.lines.length === 0 && quote.unavailable.length === 0)) {
    return (
      <div className="container py-10">
        <EmptyState
          icon={ShoppingBag}
          title="Your bag is empty"
          description="Looks like you haven't added anything yet. Explore our best-selling lipsticks, laces and jewellery."
          action={<ButtonLink href="/products?sort=popular">Start shopping</ButtonLink>}
        />
      </div>
    );
  }

  const s = quote.summary;
  const progress = Math.min(100, ((s.freeShippingThreshold - s.amountToFreeShipping) / s.freeShippingThreshold) * 100);
  const hasIssues = quote.unavailable.length > 0;

  return (
    <div className="container py-8 pb-32 md:py-12">
      <h1 className="font-display text-4xl font-semibold">Shopping bag</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
        <div>
          <div className="card mb-5 p-4">
            {s.amountToFreeShipping > 0 ? (
              <p className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-plum-600" /> Add <b>{formatPrice(s.amountToFreeShipping)}</b> more for <b>FREE shipping</b>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-success">
                <Truck className="h-4 w-4" /> Yay! Your order qualifies for free shipping
              </p>
            )}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand">
              <div className="h-full rounded-full bg-gradient-to-r from-plum-500 to-gold-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {hasIssues && (
            <div className="card mb-5 border-danger/20 p-5">
              <p className="text-sm font-semibold text-danger">Some items need your attention</p>
              <ul className="divide-y divide-line">
                {quote.unavailable.map((l) => (
                  <CartLine key={l.variantId} line={l} />
                ))}
              </ul>
            </div>
          )}

          <ul className="card divide-y divide-line px-5">
            {quote.lines.map((l) => (
              <CartLine key={l.variantId} line={l} />
            ))}
          </ul>
          <Link href="/products" className="mt-5 inline-block text-sm font-semibold text-plum-700 hover:underline">
            ← Continue shopping
          </Link>
        </div>

        <div className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <CouponBox />
          <OrderSummary
            summary={s}
            couponCode={quote.coupon?.code}
            footer={
              <>
                <ButtonLink href="/checkout" size="lg" block className={quote.lines.length === 0 ? 'pointer-events-none opacity-50' : ''}>
                  Proceed to checkout
                </ButtonLink>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
                  <ShieldCheck className="h-3.5 w-3.5" /> Safe &amp; secure payments
                </p>
              </>
            }
          />
          <p className="text-center text-xs text-ink-muted">Shipping &amp; COD charges are confirmed at checkout for your pincode.</p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[56px] z-30 flex items-center justify-between gap-4 border-t border-line bg-white px-4 py-3 md:hidden">
        <div>
          <p className="text-lg font-bold">{formatPrice(s.grandTotal)}</p>
          <p className="text-[11px] text-ink-muted">Total · incl. GST</p>
        </div>
        <ButtonLink href="/checkout" className="flex-1">
          Checkout
        </ButtonLink>
      </div>
    </div>
  );
}
