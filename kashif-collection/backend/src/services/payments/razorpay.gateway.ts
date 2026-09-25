import Razorpay from 'razorpay';
import { env, features } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { hmacSha256Hex, safeEqual } from '../../utils/crypto';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export interface RazorpayPaymentSummary {
  id: string;
  status: string;
  amount: number;
  order_id?: string;
}

/** Narrow interface over the Razorpay SDK so it can be substituted in tests. */
export interface RazorpayClient {
  createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder>;
  fetchOrderPayments(razorpayOrderId: string): Promise<RazorpayPaymentSummary[]>;
  refund(paymentId: string, amount: number, notes: Record<string, string>): Promise<{ id: string; status: string }>;
}

class SdkRazorpayClient implements RazorpayClient {
  private sdk = new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! });

  async createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
    const order = await this.sdk.orders.create(input);
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  }

  async fetchOrderPayments(razorpayOrderId: string) {
    const res = await this.sdk.orders.fetchPayments(razorpayOrderId);
    return res.items.map((p) => ({ id: p.id, status: p.status, amount: Number(p.amount), order_id: p.order_id }));
  }

  async refund(paymentId: string, amount: number, notes: Record<string, string>) {
    const r = await this.sdk.payments.refund(paymentId, { amount, notes });
    return { id: r.id, status: String(r.status) };
  }
}

let client: RazorpayClient | null = null;

export function getRazorpayClient(): RazorpayClient {
  if (client) return client;
  if (!features.razorpay) {
    throw AppError.serviceUnavailable('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.', 'PAYMENT_GATEWAY_NOT_CONFIGURED');
  }
  client = new SdkRazorpayClient();
  return client;
}

/** Test hook */
export function setRazorpayClient(c: RazorpayClient | null) {
  client = c;
}

/** Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
export function verifyRazorpayPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string, secret = env.RAZORPAY_KEY_SECRET): boolean {
  if (!secret || !signature) return false;
  return safeEqual(hmacSha256Hex(secret, `${razorpayOrderId}|${razorpayPaymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret) */
export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string | undefined, secret = env.RAZORPAY_WEBHOOK_SECRET): boolean {
  if (!secret || !signature) return false;
  return safeEqual(hmacSha256Hex(secret, rawBody.toString('utf8')), signature);
}
