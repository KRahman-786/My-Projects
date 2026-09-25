import Stripe from 'stripe';
import { env, features } from '../../config/env';
import { AppError } from '../../utils/AppError';

export interface StripePaymentIntentSummary {
  id: string;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  client_secret: string | null;
  latest_charge: string | null;
  metadata: Record<string, string>;
  last_payment_error?: { message?: string } | null;
}

/** Narrow interface over the Stripe SDK so it can be substituted in tests. */
export interface StripeClient {
  createPaymentIntent(input: { amount: number; currency: string; metadata: Record<string, string>; idempotencyKey: string }): Promise<StripePaymentIntentSummary>;
  retrievePaymentIntent(id: string): Promise<StripePaymentIntentSummary>;
  refund(paymentIntentId: string, amount: number): Promise<{ id: string; status: string }>;
}

function summarize(pi: Stripe.PaymentIntent): StripePaymentIntentSummary {
  return {
    id: pi.id,
    status: pi.status,
    amount: pi.amount,
    amount_received: pi.amount_received,
    currency: pi.currency,
    client_secret: pi.client_secret,
    latest_charge: typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge?.id ?? null),
    metadata: pi.metadata,
    last_payment_error: pi.last_payment_error ? { message: pi.last_payment_error.message } : null,
  };
}

let sdk: Stripe | null = null;
function getSdk(): Stripe {
  if (!features.stripe) {
    throw AppError.serviceUnavailable('Stripe is not configured. Set STRIPE_SECRET_KEY.', 'PAYMENT_GATEWAY_NOT_CONFIGURED');
  }
  sdk ??= new Stripe(env.STRIPE_SECRET_KEY!);
  return sdk;
}

class SdkStripeClient implements StripeClient {
  async createPaymentIntent(input: { amount: number; currency: string; metadata: Record<string, string>; idempotencyKey: string }) {
    const pi = await getSdk().paymentIntents.create(
      { amount: input.amount, currency: input.currency, metadata: input.metadata, automatic_payment_methods: { enabled: true } },
      { idempotencyKey: input.idempotencyKey },
    );
    return summarize(pi);
  }
  async retrievePaymentIntent(id: string) {
    return summarize(await getSdk().paymentIntents.retrieve(id));
  }
  async refund(paymentIntentId: string, amount: number) {
    const r = await getSdk().refunds.create({ payment_intent: paymentIntentId, amount });
    return { id: r.id, status: r.status ?? 'pending' };
  }
}

let client: StripeClient | null = null;
export function getStripeClient(): StripeClient {
  if (client) return client;
  if (!features.stripe) {
    throw AppError.serviceUnavailable('Stripe is not configured. Set STRIPE_SECRET_KEY.', 'PAYMENT_GATEWAY_NOT_CONFIGURED');
  }
  client = new SdkStripeClient();
  return client;
}

/** Test hook */
export function setStripeClient(c: StripeClient | null) {
  client = c;
}

/**
 * Verifies the Stripe-Signature header against the raw body using STRIPE_WEBHOOK_SECRET.
 * Uses the SDK's offline verifier (no network, no secret key needed).
 */
export function constructStripeEvent(rawBody: Buffer, signature: string | undefined, secret = env.STRIPE_WEBHOOK_SECRET): Stripe.Event {
  if (!secret) throw AppError.serviceUnavailable('STRIPE_WEBHOOK_SECRET is not configured', 'WEBHOOK_NOT_CONFIGURED');
  if (!signature) throw AppError.badRequest('Missing Stripe-Signature header', 'INVALID_WEBHOOK_SIGNATURE');
  try {
    return Stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw AppError.badRequest('Invalid Stripe webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }
}
