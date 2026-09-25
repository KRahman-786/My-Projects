import { Prisma, type PaymentMethod } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/AppError';
import { markOrderPaid, markPaymentFailed } from '../order.service';
import {
  getRazorpayClient,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './razorpay.gateway';
import { constructStripeEvent, getStripeClient } from './stripe.gateway';

async function getPayableOrder(userId: string, orderNumber: string, method: PaymentMethod) {
  const order = await prisma.order.findFirst({ where: { orderNumber, userId }, include: { user: { select: { name: true, email: true, phone: true } } } });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  if (order.paymentMethod !== method) throw AppError.badRequest(`This order is not set up for ${method} payment`, 'PAYMENT_METHOD_MISMATCH');
  if (order.paymentStatus === 'PAID') throw AppError.conflict('This order has already been paid', 'ORDER_ALREADY_PAID');
  if (order.status !== 'PENDING') throw AppError.unprocessable('This order can no longer be paid', 'ORDER_NOT_PAYABLE');
  if (!order.reservationExpiresAt || order.reservationExpiresAt < new Date()) {
    throw AppError.unprocessable('The payment window for this order has expired. Please place the order again.', 'PAYMENT_WINDOW_EXPIRED');
  }
  return order;
}

/** Records processed webhook ids; returns false when the event was already handled (duplicate delivery). */
async function isNewWebhookEvent(gateway: PaymentMethod, eventId: string) {
  const seen = await prisma.webhookEvent.findUnique({ where: { gateway_eventId: { gateway, eventId } } });
  return !seen;
}
async function rememberWebhookEvent(gateway: PaymentMethod, eventId: string, type: string) {
  try {
    await prisma.webhookEvent.create({ data: { gateway, eventId, type } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }
}

// ─────────────────────────── Razorpay ───────────────────────────

export async function createRazorpayPayment(userId: string, orderNumber: string) {
  const order = await getPayableOrder(userId, orderNumber, 'RAZORPAY');
  const client = getRazorpayClient();

  // A Razorpay order accepts multiple attempts until one succeeds, so reuse it for retries.
  let payment = await prisma.payment.findFirst({
    where: { orderId: order.id, gateway: 'RAZORPAY', status: { in: ['PENDING', 'FAILED'] }, amount: order.grandTotal },
    orderBy: { createdAt: 'desc' },
  });
  if (!payment) {
    const rzp = await client.createOrder({
      amount: order.grandTotal,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderNumber: order.orderNumber, orderId: order.id },
    });
    payment = await prisma.payment.create({
      data: { orderId: order.id, gateway: 'RAZORPAY', amount: rzp.amount, currency: rzp.currency, gatewayOrderId: rzp.id, status: 'PENDING' },
    });
  } else if (payment.status === 'FAILED') {
    payment = await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING' } });
  }

  return {
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: payment.gatewayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    orderNumber: order.orderNumber,
    name: 'Kashif Collection',
    prefill: { name: order.user.name, email: order.user.email, contact: order.user.phone ?? order.shipPhone },
    expiresAt: order.reservationExpiresAt,
  };
}

export async function verifyRazorpayPayment(
  userId: string,
  input: { orderNumber: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
) {
  const payment = await prisma.payment.findFirst({
    where: { gateway: 'RAZORPAY', gatewayOrderId: input.razorpayOrderId, order: { orderNumber: input.orderNumber, userId } },
  });
  if (!payment) throw AppError.notFound('Payment not found for this order', 'PAYMENT_NOT_FOUND');

  if (!verifyRazorpayPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
    logger.warn('Razorpay signature verification failed', { orderNumber: input.orderNumber });
    throw AppError.badRequest('Payment verification failed. If money was deducted it will be reconciled automatically.', 'PAYMENT_VERIFICATION_FAILED');
  }
  const result = await markOrderPaid({
    orderId: payment.orderId,
    paymentId: payment.id,
    gatewayPaymentId: input.razorpayPaymentId,
    amount: payment.amount,
    source: 'client-verify',
  });
  return { orderNumber: result.orderNumber, alreadyProcessed: result.alreadyProcessed };
}

export async function reportRazorpayFailure(userId: string, input: { orderNumber: string; razorpayOrderId: string; reason?: string }) {
  const payment = await prisma.payment.findFirst({
    where: { gateway: 'RAZORPAY', gatewayOrderId: input.razorpayOrderId, order: { orderNumber: input.orderNumber, userId } },
  });
  if (!payment) throw AppError.notFound('Payment not found for this order', 'PAYMENT_NOT_FOUND');
  // Client-reported failures only move PENDING → FAILED; a later successful webhook still wins.
  await markPaymentFailed(payment.id, input.reason ?? 'Payment failed or was cancelled by the customer');
}

interface RazorpayWebhookBody {
  event: string;
  payload?: {
    payment?: { entity: { id: string; order_id: string; amount: number; status: string; error_description?: string } };
    order?: { entity: { id: string; amount_paid: number } };
    refund?: { entity: { id: string; payment_id: string; status: string } };
  };
}

export async function handleRazorpayWebhook(rawBody: Buffer | undefined, signature: string | undefined, eventIdHeader: string | undefined) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw AppError.serviceUnavailable('RAZORPAY_WEBHOOK_SECRET is not configured', 'WEBHOOK_NOT_CONFIGURED');
  if (!rawBody || !verifyRazorpayWebhookSignature(rawBody, signature)) {
    throw AppError.badRequest('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }
  const body = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookBody;
  const eventId = eventIdHeader ?? `${body.event}:${body.payload?.payment?.entity.id ?? body.payload?.refund?.entity.id ?? ''}`;
  if (!(await isNewWebhookEvent('RAZORPAY', eventId))) return { duplicate: true };

  const paymentEntity = body.payload?.payment?.entity;
  if ((body.event === 'payment.captured' || body.event === 'order.paid') && paymentEntity) {
    const payment = await prisma.payment.findUnique({ where: { gateway_gatewayOrderId: { gateway: 'RAZORPAY', gatewayOrderId: paymentEntity.order_id } } });
    if (payment) {
      await markOrderPaid({ orderId: payment.orderId, paymentId: payment.id, gatewayPaymentId: paymentEntity.id, amount: paymentEntity.amount, source: 'webhook' });
    } else {
      logger.warn('Razorpay webhook for unknown order', { razorpayOrderId: paymentEntity.order_id });
    }
  } else if (body.event === 'payment.failed' && paymentEntity) {
    const payment = await prisma.payment.findUnique({ where: { gateway_gatewayOrderId: { gateway: 'RAZORPAY', gatewayOrderId: paymentEntity.order_id } } });
    if (payment) await markPaymentFailed(payment.id, paymentEntity.error_description ?? 'Payment failed');
  } else if (body.event === 'refund.processed' && body.payload?.refund) {
    await prisma.refund.updateMany({
      where: { gatewayRefundId: body.payload.refund.entity.id, status: { not: 'PROCESSED' } },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  }
  await rememberWebhookEvent('RAZORPAY', eventId, body.event);
  return { duplicate: false };
}

// ──────────────────────────── Stripe ────────────────────────────

export async function createStripePayment(userId: string, orderNumber: string) {
  const order = await getPayableOrder(userId, orderNumber, 'STRIPE');
  const client = getStripeClient();

  const existing = await prisma.payment.findFirst({
    where: { orderId: order.id, gateway: 'STRIPE', status: { in: ['PENDING', 'FAILED'] }, amount: order.grandTotal },
    orderBy: { createdAt: 'desc' },
  });
  if (existing?.gatewayOrderId) {
    const pi = await client.retrievePaymentIntent(existing.gatewayOrderId);
    if (pi.status !== 'canceled' && pi.client_secret) {
      if (existing.status === 'FAILED') await prisma.payment.update({ where: { id: existing.id }, data: { status: 'PENDING' } });
      return { clientSecret: pi.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY, amount: existing.amount, currency: 'INR', orderNumber };
    }
  }

  const pi = await client.createPaymentIntent({
    amount: order.grandTotal,
    currency: 'inr',
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
    idempotencyKey: `kc-${order.id}-${order.grandTotal}-${existing ? Date.now() : 'first'}`,
  });
  await prisma.payment.create({ data: { orderId: order.id, gateway: 'STRIPE', amount: pi.amount, currency: 'INR', gatewayOrderId: pi.id, status: 'PENDING' } });
  return { clientSecret: pi.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY, amount: pi.amount, currency: 'INR', orderNumber };
}

/**
 * Called by the storefront after stripe.confirmPayment(). The PaymentIntent is re-fetched from Stripe;
 * the client's claim of success is never trusted.
 */
export async function confirmStripePayment(userId: string, orderNumber: string) {
  const order = await prisma.order.findFirst({ where: { orderNumber, userId } });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  const payment = await prisma.payment.findFirst({ where: { orderId: order.id, gateway: 'STRIPE', gatewayOrderId: { not: null } }, orderBy: { createdAt: 'desc' } });
  if (!payment?.gatewayOrderId) throw AppError.notFound('Payment not found for this order', 'PAYMENT_NOT_FOUND');

  const pi = await getStripeClient().retrievePaymentIntent(payment.gatewayOrderId);
  if (pi.status === 'succeeded') {
    await markOrderPaid({ orderId: order.id, paymentId: payment.id, gatewayPaymentId: pi.latest_charge ?? pi.id, amount: pi.amount_received, source: 'client-verify' });
    return { status: 'PAID' as const, orderNumber };
  }
  if (pi.status === 'processing' || pi.status === 'requires_capture') return { status: 'PROCESSING' as const, orderNumber };
  if (pi.status === 'requires_payment_method' && pi.last_payment_error) {
    await markPaymentFailed(payment.id, pi.last_payment_error.message ?? 'Payment failed');
    return { status: 'FAILED' as const, orderNumber };
  }
  return { status: 'PENDING' as const, orderNumber };
}

export async function handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
  if (!rawBody) throw AppError.badRequest('Missing body', 'INVALID_WEBHOOK_SIGNATURE');
  const event = constructStripeEvent(rawBody, signature);
  if (!(await isNewWebhookEvent('STRIPE', event.id))) return { duplicate: true };

  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    const payment = await prisma.payment.findUnique({ where: { gateway_gatewayOrderId: { gateway: 'STRIPE', gatewayOrderId: pi.id } } });
    if (!payment) {
      logger.warn('Stripe webhook for unknown PaymentIntent', { paymentIntent: pi.id });
    } else if (event.type === 'payment_intent.succeeded') {
      const charge = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge?.id ?? pi.id);
      await markOrderPaid({ orderId: payment.orderId, paymentId: payment.id, gatewayPaymentId: charge, amount: pi.amount_received, source: 'webhook' });
    } else {
      await markPaymentFailed(payment.id, pi.last_payment_error?.message ?? 'Payment failed');
    }
  }
  await rememberWebhookEvent('STRIPE', event.id, event.type);
  return { duplicate: false };
}

// ──────────────────────── Reconciliation ────────────────────────

/**
 * Asks the gateway whether any attempt for this order succeeded (e.g. the customer paid but closed the
 * browser before the callback and the webhook was lost). Returns true when the order should NOT be expired.
 */
export async function reconcileOrderPayment(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const payments = await prisma.payment.findMany({ where: { orderId, gatewayOrderId: { not: null }, status: { in: ['PENDING', 'FAILED', 'AUTHORIZED'] } } });
  const ageMs = Date.now() - (order.reservationExpiresAt?.getTime() ?? Date.now());
  let unknown = false;
  for (const p of payments) {
    try {
      if (p.gateway === 'RAZORPAY') {
        const attempts = await getRazorpayClient().fetchOrderPayments(p.gatewayOrderId!);
        const captured = attempts.find((a) => a.status === 'captured');
        if (captured) {
          await markOrderPaid({ orderId, paymentId: p.id, gatewayPaymentId: captured.id, amount: captured.amount, source: 'reconciliation' });
          return true;
        }
      } else if (p.gateway === 'STRIPE') {
        const pi = await getStripeClient().retrievePaymentIntent(p.gatewayOrderId!);
        if (pi.status === 'succeeded') {
          await markOrderPaid({ orderId, paymentId: p.id, gatewayPaymentId: pi.latest_charge ?? pi.id, amount: pi.amount_received, source: 'reconciliation' });
          return true;
        }
        if (pi.status === 'processing') return true;
      }
    } catch (error) {
      unknown = true;
      logger.warn('Payment reconciliation failed', { orderId, error: (error as Error).message });
    }
  }
  // If the gateway could not be reached, keep the reservation for up to 24h past expiry before giving up.
  return unknown && ageMs < 24 * 60 * 60 * 1000;
}

/** Storefront configuration for enabling payment buttons (no secrets). */
export function publicPaymentConfig() {
  return {
    razorpay: { enabled: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET), keyId: env.RAZORPAY_KEY_ID ?? null },
    stripe: { enabled: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY), publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null },
  };
}
