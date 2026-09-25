import request from 'supertest';
import Stripe from 'stripe';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, createProduct, customerAgent, inventoryOf, prisma, resetDb } from './helpers';
import { hmacSha256Hex } from '../src/utils/crypto';
import {
  setRazorpayClient,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  type RazorpayClient,
  type RazorpayPaymentSummary,
} from '../src/services/payments/razorpay.gateway';
import { setStripeClient, type StripeClient, type StripePaymentIntentSummary } from '../src/services/payments/stripe.gateway';
import { expireStaleOrders } from '../src/services/order.service';
import { reconcileOrderPayment } from '../src/services/payments/payment.service';

const RZP_SECRET = process.env.RAZORPAY_KEY_SECRET!;
const RZP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// ── Fake gateways: replace only the network calls to Razorpay/Stripe. All verification logic is real. ──
let rzpSeq = 0;
const rzpPayments = new Map<string, RazorpayPaymentSummary[]>();
const fakeRazorpay: RazorpayClient = {
  async createOrder(input) {
    const id = `order_test_${++rzpSeq}`;
    rzpPayments.set(id, []);
    return { id, amount: input.amount, currency: input.currency };
  },
  async fetchOrderPayments(id) {
    return rzpPayments.get(id) ?? [];
  },
  async refund(paymentId) {
    return { id: `rfnd_${paymentId}`, status: 'processed' };
  },
};

const intents = new Map<string, StripePaymentIntentSummary>();
const fakeStripe: StripeClient = {
  async createPaymentIntent(input) {
    const id = `pi_test_${intents.size + 1}`;
    const pi = { id, status: 'requires_payment_method', amount: input.amount, amount_received: 0, currency: input.currency, client_secret: `${id}_secret_abc`, latest_charge: null, metadata: input.metadata };
    intents.set(id, pi);
    return pi;
  },
  async retrievePaymentIntent(id) {
    const pi = intents.get(id);
    if (!pi) throw new Error('No such payment intent');
    return pi;
  },
  async refund(id) {
    return { id: `re_${id}`, status: 'succeeded' };
  },
};

beforeAll(() => {
  setRazorpayClient(fakeRazorpay);
  setStripeClient(fakeStripe);
});
afterAll(() => {
  setRazorpayClient(null);
  setStripeClient(null);
});

async function pendingOrder(method: 'RAZORPAY' | 'STRIPE', stock = 5, qty = 1) {
  const p = await createProduct({ price: 40000, mrp: 50000, stocks: [stock] });
  const c = await customerAgent();
  await c.agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: qty });
  const res = await c.agent.post('/api/orders').send({ addressId: c.addressId, paymentMethod: method });
  expect(res.status).toBe(201);
  return { ...c, order: res.body.data as { orderNumber: string; grandTotal: number }, variantId: p.variants[0]!.id };
}

const sign = (orderId: string, paymentId: string) => hmacSha256Hex(RZP_SECRET, `${orderId}|${paymentId}`);

function rzpWebhook(event: string, orderId: string, paymentId: string, amount: number, eventId: string, secret = RZP_WEBHOOK_SECRET) {
  const body = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, status: event === 'payment.failed' ? 'failed' : 'captured' } } } });
  return request(app)
    .post('/api/payments/razorpay/webhook')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', hmacSha256Hex(secret, body))
    .set('x-razorpay-event-id', eventId)
    .send(body);
}

describe('Razorpay signature verification (unit)', () => {
  it('accepts valid and rejects tampered signatures', () => {
    const sig = hmacSha256Hex('secret', 'order_1|pay_1');
    expect(verifyRazorpayPaymentSignature('order_1', 'pay_1', sig, 'secret')).toBe(true);
    expect(verifyRazorpayPaymentSignature('order_1', 'pay_2', sig, 'secret')).toBe(false);
    expect(verifyRazorpayPaymentSignature('order_1', 'pay_1', 'deadbeef', 'secret')).toBe(false);
    expect(verifyRazorpayPaymentSignature('order_1', 'pay_1', sig, undefined)).toBe(false);
    const body = Buffer.from('{"a":1}');
    expect(verifyRazorpayWebhookSignature(body, hmacSha256Hex('wh', '{"a":1}'), 'wh')).toBe(true);
    expect(verifyRazorpayWebhookSignature(body, hmacSha256Hex('other', '{"a":1}'), 'wh')).toBe(false);
  });
});

describe('Razorpay flow', () => {
  beforeEach(resetDb);

  it('creates a gateway order server-side and marks PAID only after signature verification', async () => {
    const { agent, order, variantId } = await pendingOrder('RAZORPAY');
    const create = await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber });
    expect(create.status).toBe(200);
    expect(create.body.data.amount).toBe(order.grandTotal);
    expect(create.body.data.keyId).toBe(process.env.RAZORPAY_KEY_ID);
    expect(JSON.stringify(create.body)).not.toContain(RZP_SECRET);
    const rzpOrderId = create.body.data.razorpayOrderId as string;

    // Forged "success" from the frontend is rejected.
    const forged = await agent.post('/api/payments/razorpay/verify').send({ orderNumber: order.orderNumber, razorpayOrderId: rzpOrderId, razorpayPaymentId: 'pay_1', razorpaySignature: 'fake' });
    expect(forged.status).toBe(400);
    expect(forged.body.errorCode).toBe('PAYMENT_VERIFICATION_FAILED');
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } })).paymentStatus).toBe('PENDING');

    const verify = await agent.post('/api/payments/razorpay/verify').send({
      orderNumber: order.orderNumber,
      razorpayOrderId: rzpOrderId,
      razorpayPaymentId: 'pay_1',
      razorpaySignature: sign(rzpOrderId, 'pay_1'),
    });
    expect(verify.status).toBe(200);
    const paid = (await agent.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(paid.status).toBe('PAID');
    expect(paid.paymentStatus).toBe('PAID');
    expect(paid.payments[0]).toMatchObject({ gateway: 'RAZORPAY', status: 'PAID', gatewayPaymentId: 'pay_1', amount: order.grandTotal, currency: 'INR' });
    expect(await inventoryOf(variantId)).toMatchObject({ totalStock: 4, reservedStock: 0, availableStock: 4 });
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('handles duplicate verification callbacks idempotently', async () => {
    const { agent, order, variantId } = await pendingOrder('RAZORPAY');
    const rzpOrderId = (await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).body.data.razorpayOrderId;
    const payload = { orderNumber: order.orderNumber, razorpayOrderId: rzpOrderId, razorpayPaymentId: 'pay_dup', razorpaySignature: sign(rzpOrderId, 'pay_dup') };
    const [a, b] = await Promise.all([agent.post('/api/payments/razorpay/verify').send(payload), agent.post('/api/payments/razorpay/verify').send(payload)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.data.alreadyProcessed, b.body.data.alreadyProcessed].sort()).toEqual([false, true]);
    expect(await inventoryOf(variantId)).toMatchObject({ totalStock: 4, reservedStock: 0 });
    expect(await prisma.orderStatusHistory.count({ where: { toStatus: 'PAID' } })).toBe(1);
  });

  it('confirms payment via webhook when the frontend disconnects, and ignores duplicate webhooks', async () => {
    const { agent, order, variantId } = await pendingOrder('RAZORPAY');
    const rzpOrderId = (await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).body.data.razorpayOrderId;

    const bad = await rzpWebhook('payment.captured', rzpOrderId, 'pay_wh', order.grandTotal, 'evt_1', 'wrong-secret');
    expect(bad.status).toBe(400);
    expect(bad.body.errorCode).toBe('INVALID_WEBHOOK_SIGNATURE');

    const first = await rzpWebhook('payment.captured', rzpOrderId, 'pay_wh', order.grandTotal, 'evt_1');
    expect(first.status).toBe(200);
    expect(first.body.data.duplicate).toBe(false);
    const dup = await rzpWebhook('payment.captured', rzpOrderId, 'pay_wh', order.grandTotal, 'evt_1');
    expect(dup.body.data.duplicate).toBe(true);
    // A different event for the same payment (order.paid) is also harmless.
    await rzpWebhook('order.paid', rzpOrderId, 'pay_wh', order.grandTotal, 'evt_2');

    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } });
    expect(o.status).toBe('PAID');
    expect(await inventoryOf(variantId)).toMatchObject({ totalStock: 4, reservedStock: 0 });
    expect(await prisma.inventoryTransaction.count({ where: { type: 'SALE' } })).toBe(1);
  });

  it('records failed payments, allows a retry, and accepts the successful retry', async () => {
    const { agent, order } = await pendingOrder('RAZORPAY');
    const rzpOrderId = (await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).body.data.razorpayOrderId;
    await agent.post('/api/payments/razorpay/failed').send({ orderNumber: order.orderNumber, razorpayOrderId: rzpOrderId, reason: 'Card declined' });
    let o = (await agent.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(o.paymentStatus).toBe('FAILED');
    expect(o.status).toBe('PENDING');
    expect(o.canPay).toBe(true);

    const retry = await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber });
    expect(retry.body.data.razorpayOrderId).toBe(rzpOrderId); // same gateway order reused
    await agent.post('/api/payments/razorpay/verify').send({ orderNumber: order.orderNumber, razorpayOrderId: rzpOrderId, razorpayPaymentId: 'pay_ok', razorpaySignature: sign(rzpOrderId, 'pay_ok') });
    o = (await agent.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(o.paymentStatus).toBe('PAID');
  });

  it('does not let a failure webhook override a successful payment', async () => {
    const { agent, order } = await pendingOrder('RAZORPAY');
    const rzpOrderId = (await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).body.data.razorpayOrderId;
    await rzpWebhook('payment.captured', rzpOrderId, 'pay_a', order.grandTotal, 'evt_ok');
    await rzpWebhook('payment.failed', rzpOrderId, 'pay_b', order.grandTotal, 'evt_fail');
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } });
    expect(o.paymentStatus).toBe('PAID');
  });

  it('reconciles a captured payment before expiring an order (payment succeeded, callback and webhook lost)', async () => {
    const { agent, order } = await pendingOrder('RAZORPAY');
    const rzpOrderId = (await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).body.data.razorpayOrderId;
    rzpPayments.set(rzpOrderId, [{ id: 'pay_lost', status: 'captured', amount: order.grandTotal, order_id: rzpOrderId }]);
    await prisma.order.update({ where: { orderNumber: order.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expireStaleOrders(reconcileOrderPayment)).toBe(0);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } })).status).toBe('PAID');
  });

  it('restores an expired order when a late payment arrives and stock is still available', async () => {
    const { agent, order, variantId } = await pendingOrder('RAZORPAY', 5);
    const rzpOrderId = (await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).body.data.razorpayOrderId;
    await prisma.order.update({ where: { orderNumber: order.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireStaleOrders();
    expect(await inventoryOf(variantId)).toMatchObject({ reservedStock: 0, availableStock: 5 });

    await rzpWebhook('payment.captured', rzpOrderId, 'pay_late', order.grandTotal, 'evt_late');
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } });
    expect(o.status).toBe('PAID');
    expect(await inventoryOf(variantId)).toMatchObject({ totalStock: 4, reservedStock: 0, availableStock: 4 });
  });

  it('creates a refund when a late payment arrives but the stock has been sold (payment succeeds, order cannot be fulfilled)', async () => {
    const { agent, order, variantId } = await pendingOrder('RAZORPAY', 1);
    const rzpOrderId = (await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).body.data.razorpayOrderId;
    await prisma.order.update({ where: { orderNumber: order.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireStaleOrders();
    // Someone else buys the last unit.
    await prisma.inventory.update({ where: { variantId }, data: { totalStock: 0, availableStock: 0 } });

    const res = await rzpWebhook('payment.captured', rzpOrderId, 'pay_late2', order.grandTotal, 'evt_late2');
    expect(res.status).toBe(200);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber }, include: { refunds: true } });
    expect(o.status).toBe('CANCELLED');
    expect(o.paymentStatus).toBe('PAID');
    expect(o.refunds).toHaveLength(1);
    expect(o.refunds[0]!.amount).toBe(order.grandTotal);
    expect(await inventoryOf(variantId)).toMatchObject({ totalStock: 0, reservedStock: 0, availableStock: 0 });
  });

  it('ignores webhooks for unknown gateway orders without failing', async () => {
    const res = await rzpWebhook('payment.captured', 'order_unknown', 'pay_x', 100, 'evt_unknown');
    expect(res.status).toBe(200);
  });

  it('refuses payment for expired or other users’ orders', async () => {
    const { agent, order } = await pendingOrder('RAZORPAY');
    const other = await customerAgent();
    expect((await other.agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber })).status).toBe(404);
    await prisma.order.update({ where: { orderNumber: order.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const expired = await agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber });
    expect(expired.status).toBe(422);
    expect(expired.body.errorCode).toBe('PAYMENT_WINDOW_EXPIRED');
  });
});

describe('Stripe flow', () => {
  beforeEach(() => {
    intents.clear();
    return resetDb();
  });

  function stripeWebhook(event: object, secret = STRIPE_WEBHOOK_SECRET) {
    const payload = JSON.stringify(event);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    return request(app).post('/api/payments/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', header).send(payload);
  }

  it('creates a PaymentIntent and only marks PAID after server-side retrieval shows success', async () => {
    const { agent, order, variantId } = await pendingOrder('STRIPE');
    const create = await agent.post('/api/payments/stripe/create').send({ orderNumber: order.orderNumber });
    expect(create.status).toBe(200);
    expect(create.body.data.clientSecret).toMatch(/_secret_/);
    expect(JSON.stringify(create.body)).not.toContain(process.env.STRIPE_SECRET_KEY!);
    const piId = [...intents.keys()][0]!;

    // Frontend claims success but Stripe says otherwise → not paid.
    let confirm = await agent.post('/api/payments/stripe/confirm').send({ orderNumber: order.orderNumber });
    expect(confirm.body.data.status).toBe('PENDING');
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } })).paymentStatus).toBe('PENDING');

    intents.set(piId, { ...intents.get(piId)!, status: 'succeeded', amount_received: order.grandTotal, latest_charge: 'ch_123' });
    confirm = await agent.post('/api/payments/stripe/confirm').send({ orderNumber: order.orderNumber });
    expect(confirm.body.data.status).toBe('PAID');
    const o = (await agent.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(o.status).toBe('PAID');
    expect(o.payments[0].gatewayPaymentId).toBe('ch_123');
    expect(await inventoryOf(variantId)).toMatchObject({ totalStock: 4, reservedStock: 0 });
  });

  it('marks failed payments from Stripe state', async () => {
    const { agent, order } = await pendingOrder('STRIPE');
    await agent.post('/api/payments/stripe/create').send({ orderNumber: order.orderNumber });
    const piId = [...intents.keys()][0]!;
    intents.set(piId, { ...intents.get(piId)!, status: 'requires_payment_method', last_payment_error: { message: 'Your card was declined.' } });
    const confirm = await agent.post('/api/payments/stripe/confirm').send({ orderNumber: order.orderNumber });
    expect(confirm.body.data.status).toBe('FAILED');
    const payment = await prisma.payment.findFirstOrThrow({ where: { gatewayOrderId: piId } });
    expect(payment).toMatchObject({ status: 'FAILED', failureReason: 'Your card was declined.' });
  });

  it('verifies webhook signatures and processes each event once', async () => {
    const { agent, order } = await pendingOrder('STRIPE');
    await agent.post('/api/payments/stripe/create').send({ orderNumber: order.orderNumber });
    const piId = [...intents.keys()][0]!;
    const event = {
      id: 'evt_stripe_1',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { id: piId, object: 'payment_intent', amount: order.grandTotal, amount_received: order.grandTotal, latest_charge: 'ch_wh', metadata: {} } },
    };
    const forged = await stripeWebhook(event, 'whsec_wrong');
    expect(forged.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } })).paymentStatus).toBe('PENDING');

    const ok = await stripeWebhook(event);
    expect(ok.status).toBe(200);
    expect(ok.body.data.duplicate).toBe(false);
    const dup = await stripeWebhook(event);
    expect(dup.body.data.duplicate).toBe(true);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: order.orderNumber } });
    expect(o.status).toBe('PAID');
    expect(await prisma.inventoryTransaction.count({ where: { type: 'SALE' } })).toBe(1);
  });

  it('rejects unsigned webhook requests', async () => {
    const res = await request(app).post('/api/payments/stripe/webhook').set('Content-Type', 'application/json').send('{"id":"evt"}');
    expect(res.status).toBe(400);
  });
});

describe('COD', () => {
  beforeEach(resetDb);

  it('marks COD payment as PAID when the admin marks the order delivered', async () => {
    const p = await createProduct({ stocks: [5] });
    const c = await customerAgent();
    await c.agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 1 });
    const order = (await c.agent.post('/api/orders').send({ addressId: c.addressId, paymentMethod: 'COD' })).body.data;
    expect(order.payments[0]).toMatchObject({ gateway: 'COD', status: 'PENDING' });

    const { adminAgent } = await import('./helpers');
    const { agent: admin } = await adminAgent();
    for (const status of ['PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']) {
      const r = await admin.patch(`/api/admin/orders/${order.orderNumber}/status`).send({ status, trackingNumber: status === 'SHIPPED' ? 'AWB123' : undefined });
      expect(r.status).toBe(200);
    }
    const o = (await c.agent.get(`/api/orders/${order.orderNumber}`)).body.data;
    expect(o).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID', trackingNumber: 'AWB123' });
    expect(o.payments[0].status).toBe('PAID');
    expect(o.canReturn).toBe(true);
  });

  it('rejects COD payment attempts through gateways', async () => {
    const p = await createProduct();
    const c = await customerAgent();
    await c.agent.post('/api/cart/items').send({ variantId: p.variants[0]!.id, quantity: 1 });
    const order = (await c.agent.post('/api/orders').send({ addressId: c.addressId, paymentMethod: 'COD' })).body.data;
    const res = await c.agent.post('/api/payments/razorpay/create').send({ orderNumber: order.orderNumber });
    expect(res.body.errorCode).toBe('PAYMENT_METHOD_MISMATCH');
  });
});
