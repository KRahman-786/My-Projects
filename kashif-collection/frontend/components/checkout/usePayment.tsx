'use client';

import { useCallback, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { paymentsApi } from '@/services/account';
import { errorMessage } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/utils/format';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay. Check your connection and try again.'));
    document.body.appendChild(s);
  });
}

const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripe(key: string) {
  if (!stripeCache.has(key)) stripeCache.set(key, loadStripe(key));
  return stripeCache.get(key)!;
}

export type PaymentOutcome = { status: 'paid' | 'processing' | 'failed' | 'dismissed'; message?: string };

interface PayTarget {
  orderNumber: string;
  paymentMethod: 'RAZORPAY' | 'STRIPE' | 'COD';
  grandTotal: number;
}

function StripeForm({ orderNumber, amount, onDone }: { orderNumber: string; amount: number; onDone: (o: PaymentOutcome) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const { error: err } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/checkout/confirmation/${orderNumber}` },
    });
    if (err) {
      setBusy(false);
      setError(err.message ?? 'Payment failed');
      return;
    }
    // Never trust the client result — ask the server to verify with Stripe.
    try {
      const res = await paymentsApi.stripeConfirm(orderNumber);
      onDone({ status: res.status === 'PAID' ? 'paid' : res.status === 'FAILED' ? 'failed' : 'processing' });
    } catch (e2) {
      onDone({ status: 'processing', message: errorMessage(e2) });
    }
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentElement />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" block size="lg" loading={busy} disabled={!stripe}>
        Pay {formatPrice(amount)}
      </Button>
      <p className="text-center text-xs text-ink-muted">Test mode: use card 4242 4242 4242 4242, any future date, any CVC.</p>
    </form>
  );
}

/**
 * Opens the right gateway for an order. Razorpay: server creates the gateway order, the checkout
 * widget collects payment and the server verifies the signature. Stripe: server creates a
 * PaymentIntent, Payment Element confirms it, and the server re-fetches it before marking paid.
 */
export function usePayment() {
  const [stripeState, setStripeState] = useState<{ orderNumber: string; clientSecret: string; key: string; amount: number; resolve: (o: PaymentOutcome) => void } | null>(null);

  const pay = useCallback(async (order: PayTarget): Promise<PaymentOutcome> => {
    if (order.paymentMethod === 'RAZORPAY') {
      await loadRazorpayScript();
      const rp = await paymentsApi.razorpayCreate(order.orderNumber);
      return new Promise<PaymentOutcome>((resolve) => {
        let settled = false;
        const done = (o: PaymentOutcome) => {
          if (!settled) {
            settled = true;
            resolve(o);
          }
        };
        const rzp = new window.Razorpay!({
          key: rp.keyId,
          amount: rp.amount,
          currency: rp.currency,
          order_id: rp.razorpayOrderId,
          name: 'Kashif Collection',
          description: `Order ${order.orderNumber}`,
          prefill: rp.prefill,
          notes: { orderNumber: order.orderNumber },
          theme: { color: '#5B1A32' },
          handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await paymentsApi.razorpayVerify({
                orderNumber: order.orderNumber,
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              });
              done({ status: 'paid' });
            } catch (e) {
              // The webhook / reconciliation job will still confirm a genuine payment.
              done({ status: 'processing', message: errorMessage(e) });
            }
          },
          modal: { ondismiss: () => done({ status: 'dismissed' }) },
        });
        rzp.on('payment.failed', (resp) => {
          void paymentsApi.razorpayFailed({ orderNumber: order.orderNumber, razorpayOrderId: rp.razorpayOrderId, reason: resp.error?.description }).catch(() => undefined);
          done({ status: 'failed', message: resp.error?.description });
        });
        rzp.open();
      });
    }
    if (order.paymentMethod === 'STRIPE') {
      const res = await paymentsApi.stripeCreate(order.orderNumber);
      const key = res.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!key) throw new Error('Card payments are not configured.');
      return new Promise<PaymentOutcome>((resolve) => setStripeState({ orderNumber: order.orderNumber, clientSecret: res.clientSecret, key, amount: res.amount, resolve }));
    }
    return { status: 'paid' };
  }, []);

  const ui = stripeState ? (
    <Modal
      open
      title="Pay by card"
      onClose={() => {
        stripeState.resolve({ status: 'dismissed' });
        setStripeState(null);
      }}
    >
      <Elements stripe={getStripe(stripeState.key)} options={{ clientSecret: stripeState.clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#5B1A32', borderRadius: '12px' } } }}>
        <StripeForm
          orderNumber={stripeState.orderNumber}
          amount={stripeState.amount}
          onDone={(o) => {
            stripeState.resolve(o);
            setStripeState(null);
          }}
        />
      </Elements>
    </Modal>
  ) : null;

  return { pay, ui };
}
