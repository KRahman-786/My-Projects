import { Prisma, type Order, type OrderStatus, type PaymentMethod } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { logger } from '../config/logger';
import { features } from '../config/env';
import { AppError } from '../utils/AppError';
import { buildMeta, getPagination } from '../utils/pagination';
import { formatINR } from '../utils/money';
import { buildQuote } from './pricing.service';
import { consumeCoupon, releaseCoupon } from './coupon.service';
import { commitStock, releaseStock, reserveStock, restock } from './inventory.service';
import { getSettings } from './settings.service';
import { getShippingProvider } from './shipping/shipping.service';
import { notifyAdmins, notifyUser } from './notification.service';
import { sendMail } from './mailer.service';

export interface CreateOrderInput {
  addressId: string;
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
  customerNote?: string;
  idempotencyKey?: string;
  /** Grand total the customer saw (paise). If the server total differs, the order is refused with PRICE_CHANGED. */
  expectedTotal?: number;
}

const ONLINE_METHODS: PaymentMethod[] = ['RAZORPAY', 'STRIPE'];

/** Allowed manual (admin) transitions. Payment-driven transitions (→PAID) are performed only by payment verification. */
const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  PENDING: ['CANCELLED'],
};

const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PAID', 'PROCESSING'];
const ADMIN_CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PAID', 'PROCESSING', 'PACKED'];

export function allowedAdminTransitions(status: OrderStatus): OrderStatus[] {
  return ADMIN_TRANSITIONS[status] ?? [];
}

// ─────────────────────────── Helpers ───────────────────────────

export async function nextOrderNumber(tx: Tx, date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "order_counters" ("year", "lastValue") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastValue" = "order_counters"."lastValue" + 1
    RETURNING "lastValue"`;
  return `KC-${year}-${String(rows[0]!.lastValue).padStart(6, '0')}`;
}

async function addHistory(tx: Tx, orderId: string, from: OrderStatus | null, to: OrderStatus, note?: string, changedById?: string) {
  await tx.orderStatusHistory.create({ data: { orderId, fromStatus: from, toStatus: to, note, changedById } });
}

/** Row lock on the order so concurrent webhooks/callbacks/admin actions are serialised. */
async function lockOrder(tx: Tx, orderId: string): Promise<Order> {
  await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
  return tx.order.findUniqueOrThrow({ where: { id: orderId } });
}

async function releaseOrderStock(tx: Tx, order: Order, reason: string) {
  const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
  if (order.stockReserved && !order.stockCommitted) {
    for (const i of items) await releaseStock(tx, i.variantId, i.quantity, { orderId: order.id, reason });
  } else if (order.stockCommitted) {
    for (const i of items) {
      await restock(tx, i.variantId, i.quantity, 'CANCEL_RESTOCK', { orderId: order.id, reason });
      await tx.product.update({ where: { id: i.productId }, data: { soldCount: { decrement: i.quantity } } });
    }
  }
  await tx.order.update({ where: { id: order.id }, data: { stockReserved: false, stockCommitted: false } });
}

async function commitOrderStock(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const i of items) {
    await commitStock(tx, i.variantId, i.quantity, { orderId, reason: 'Order confirmed' });
    await tx.product.update({ where: { id: i.productId }, data: { soldCount: { increment: i.quantity } } });
  }
  await tx.order.update({ where: { id: orderId }, data: { stockReserved: false, stockCommitted: true } });
}

async function removeOrderedItemsFromCart(tx: Tx, userId: string, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true } });
  await tx.cartItem.deleteMany({ where: { cart: { userId }, variantId: { in: items.map((i) => i.variantId) } } });
  await tx.cart.updateMany({ where: { userId }, data: { couponCode: null } });
}

async function sendOrderEmail(orderId: string, subject: string, intro: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: { select: { email: true, name: true } }, items: true } });
  if (!order) return;
  const lines = order.items.map((i) => `• ${i.productName} (${i.variantName}) × ${i.quantity} — ${formatINR(i.lineTotal)}`).join('\n');
  await sendMail({
    to: order.user.email,
    subject: `${subject} — ${order.orderNumber}`,
    text: `Hi ${order.user.name},\n\n${intro}\n\nOrder: ${order.orderNumber}\n${lines}\n\nTotal: ${formatINR(order.grandTotal)}\nPayment: ${order.paymentMethod}\n\nThank you for shopping with Kashif Collection!`,
  });
}

// ─────────────────────────── Create ───────────────────────────

export async function createOrder(userId: string, input: CreateOrderInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
    if (existing) return { order: await getOrderForCustomer(userId, existing.orderNumber), duplicate: true };
  }

  if ((input.paymentMethod === 'RAZORPAY' && !features.razorpay) || (input.paymentMethod === 'STRIPE' && !features.stripe)) {
    throw AppError.unprocessable(`${input.paymentMethod === 'RAZORPAY' ? 'Razorpay' : 'Card'} payments are currently unavailable. Please choose another method.`, 'PAYMENT_METHOD_UNAVAILABLE');
  }

  const address = await prisma.address.findFirst({ where: { id: input.addressId, userId } });
  if (!address) throw AppError.badRequest('Please select a valid delivery address', 'ADDRESS_NOT_FOUND');

  const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
  if (!cart || cart.items.length === 0) throw AppError.badRequest('Your cart is empty', 'CART_EMPTY');

  const settings = await getSettings();
  const couponCode = input.couponCode === undefined ? cart.couponCode : input.couponCode;
  const isOnline = ONLINE_METHODS.includes(input.paymentMethod);

  let order: Order;
  try {
    order = await prisma.$transaction(
      async (tx) => {
        const quote = await buildQuote(
          cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          { userId, couponCode, pincode: address.pincode, state: address.state, paymentMethod: input.paymentMethod, strict: true, db: tx },
        );
        const s = quote.summary;
        if (input.expectedTotal !== undefined && input.expectedTotal !== s.grandTotal) {
          throw AppError.conflict('Prices in your cart have changed. Please review the updated total before placing the order.', 'PRICE_CHANGED', {
            expectedTotal: input.expectedTotal,
            currentTotal: s.grandTotal,
          });
        }

        const orderNumber = await nextOrderNumber(tx);
        const created = await tx.order.create({
          data: {
            orderNumber,
            userId,
            status: isOnline ? 'PENDING' : 'CONFIRMED',
            paymentMethod: input.paymentMethod,
            paymentStatus: 'PENDING',
            mrpTotal: s.mrpTotal,
            subtotal: s.subtotal,
            productDiscount: s.productDiscount,
            couponDiscount: s.couponDiscount,
            taxTotal: s.taxTotal,
            taxInclusive: s.taxInclusive,
            cgst: s.cgst,
            sgst: s.sgst,
            igst: s.igst,
            shippingFee: s.shippingFee,
            codFee: s.codFee,
            grandTotal: s.grandTotal,
            couponId: quote.coupon?.id,
            couponCode: quote.coupon?.code,
            shipName: address.name,
            shipPhone: address.phone,
            shipHouse: address.house,
            shipStreet: address.street,
            shipArea: address.area,
            shipLandmark: address.landmark,
            shipCity: address.city,
            shipState: address.state,
            shipPincode: address.pincode,
            shipCountry: address.country,
            shippingProvider: getShippingProvider().name,
            estimatedDeliveryDate: quote.shipping?.estimatedDeliveryDate,
            reservationExpiresAt: isOnline ? new Date(Date.now() + settings.orderReservationMinutes * 60_000) : null,
            stockReserved: true,
            customerNote: input.customerNote,
            idempotencyKey: input.idempotencyKey,
            items: {
              create: quote.lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                productName: l.name,
                productSlug: l.slug,
                variantName: l.variantName,
                sku: l.sku,
                imageUrl: l.image,
                quantity: l.quantity,
                mrp: l.mrp,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
                couponShare: l.couponShare,
                gstRate: new Prisma.Decimal(l.gstRate),
                taxAmount: l.taxAmount,
                hsnCode: l.hsnCode,
              })),
            },
          },
        });

        for (const l of quote.lines) {
          await reserveStock(tx, l.variantId, l.quantity, { orderId: created.id, reason: `Order ${orderNumber}`, label: l.name });
        }
        if (quote.coupon) await consumeCoupon(tx, quote.coupon.id, userId, created.id, quote.coupon.discount);
        await addHistory(tx, created.id, null, created.status, isOnline ? 'Order created, awaiting payment' : 'Cash on Delivery order confirmed');

        if (!isOnline) {
          await tx.payment.create({ data: { orderId: created.id, gateway: 'COD', amount: s.grandTotal, status: 'PENDING' } });
          // COD orders are confirmed immediately, so the reserved units become a sale.
          await commitOrderStock(tx, created.id);
          await removeOrderedItemsFromCart(tx, userId, created.id);
        }
        return created;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    // Concurrent retry with the same idempotency key: return the order the other request created.
    if (input.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
      if (existing) return { order: await getOrderForCustomer(userId, existing.orderNumber), duplicate: true };
    }
    throw error;
  }

  if (!isOnline) {
    await notifyUser(userId, { type: 'ORDER', title: 'Order confirmed', message: `Your order ${order.orderNumber} has been confirmed.`, link: `/account/orders/${order.orderNumber}` });
    await notifyAdmins({ type: 'ORDER', title: 'New COD order', message: `${order.orderNumber} — ${formatINR(order.grandTotal)}`, link: `/admin/orders/${order.orderNumber}` });
    void sendOrderEmail(order.id, 'Order confirmed', 'Your Cash on Delivery order has been confirmed.');
  }
  return { order: await getOrderForCustomer(userId, order.orderNumber), duplicate: false };
}

// ─────────────────────── Payment outcomes ───────────────────────

export interface PaidEvent {
  orderId: string;
  paymentId: string;
  gatewayPaymentId: string;
  amount: number;
  source: 'client-verify' | 'webhook' | 'reconciliation';
}

/**
 * Idempotent: safe to call from the client verification endpoint, webhooks and reconciliation,
 * in any order and any number of times. Only the first call changes state.
 */
export async function markOrderPaid(evt: PaidEvent): Promise<{ alreadyProcessed: boolean; orderNumber: string }> {
  const result = await prisma.$transaction(
    async (tx) => {
      const order = await lockOrder(tx, evt.orderId);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: evt.paymentId } });
      if (payment.status === 'PAID' || payment.status === 'REFUNDED') return { alreadyProcessed: true, order, revived: false, refundNeeded: false };

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', gatewayPaymentId: evt.gatewayPaymentId, paidAt: new Date(), failureReason: null },
      });

      if (evt.amount !== order.grandTotal) {
        logger.error('Paid amount does not match order total', { order: order.orderNumber, paid: evt.amount, expected: order.grandTotal });
      }

      // Another payment attempt for the same order already succeeded → this one must be refunded.
      if (order.paymentStatus === 'PAID') {
        await tx.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: evt.amount, reason: 'Duplicate payment for an already paid order' } });
        await notifyAdmins({ type: 'REFUND', title: 'Duplicate payment received', message: `${order.orderNumber}: refund ${formatINR(evt.amount)}`, link: `/admin/orders/${order.orderNumber}` }, tx);
        return { alreadyProcessed: false, order, revived: false, refundNeeded: true };
      }

      if (order.status === 'PENDING' && order.stockReserved) {
        await commitOrderStock(tx, order.id);
        await tx.order.update({ where: { id: order.id }, data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date(), reservationExpiresAt: null } });
        await addHistory(tx, order.id, 'PENDING', 'PAID', `Payment received via ${payment.gateway} (${evt.source})`);
        await removeOrderedItemsFromCart(tx, order.userId, order.id);
        return { alreadyProcessed: false, order, revived: false, refundNeeded: false };
      }

      // Payment arrived after the reservation expired and the order was auto-cancelled: try to revive it.
      if (order.status === 'CANCELLED' && !order.stockReserved && !order.stockCommitted) {
        const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
        try {
          await tx.$executeRaw`SAVEPOINT revive`;
          for (const i of items) await reserveStock(tx, i.variantId, i.quantity, { orderId: order.id, reason: 'Late payment — re-reserve', label: i.productName });
          await tx.order.update({ where: { id: order.id }, data: { stockReserved: true } });
          await commitOrderStock(tx, order.id);
          await tx.order.update({ where: { id: order.id }, data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date(), cancelledAt: null, cancelReason: null } });
          await addHistory(tx, order.id, 'CANCELLED', 'PAID', 'Late payment received — order restored');
          await removeOrderedItemsFromCart(tx, order.userId, order.id);
          return { alreadyProcessed: false, order, revived: true, refundNeeded: false };
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          await tx.$executeRaw`ROLLBACK TO SAVEPOINT revive`;
          await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', paidAt: new Date() } });
          await tx.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: evt.amount, reason: 'Payment received after order expired; items out of stock' } });
          await addHistory(tx, order.id, 'CANCELLED', 'CANCELLED', 'Late payment received but stock unavailable — refund initiated');
          await notifyAdmins({ type: 'REFUND', title: 'Refund required (late payment)', message: `${order.orderNumber}: ${formatINR(evt.amount)}`, link: `/admin/orders/${order.orderNumber}` }, tx);
          return { alreadyProcessed: false, order, revived: false, refundNeeded: true };
        }
      }

      // Any other state (e.g. cancelled by the customer while paying) → keep status, record payment, refund.
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', paidAt: new Date() } });
      await tx.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount: evt.amount, reason: `Payment received for order in ${order.status} state` } });
      await notifyAdmins({ type: 'REFUND', title: 'Refund required', message: `${order.orderNumber} was paid while ${order.status}`, link: `/admin/orders/${order.orderNumber}` }, tx);
      return { alreadyProcessed: false, order, revived: false, refundNeeded: true };
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  if (!result.alreadyProcessed && !result.refundNeeded) {
    await notifyUser(result.order.userId, { type: 'PAYMENT', title: 'Payment successful', message: `We received your payment for ${result.order.orderNumber}.`, link: `/account/orders/${result.order.orderNumber}` });
    await notifyAdmins({ type: 'ORDER', title: 'New paid order', message: `${result.order.orderNumber} — ${formatINR(result.order.grandTotal)}`, link: `/admin/orders/${result.order.orderNumber}` });
    void sendOrderEmail(result.order.id, 'Payment received', 'Thank you! Your payment was successful and your order is confirmed.');
  }
  return { alreadyProcessed: result.alreadyProcessed, orderNumber: result.order.orderNumber };
}

export async function markPaymentFailed(paymentId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === 'PAID' || payment.status === 'REFUNDED' || payment.status === 'FAILED') return;
    await tx.payment.update({ where: { id: paymentId }, data: { status: 'FAILED', failureReason: reason.slice(0, 500) } });
    // The order stays PENDING with its reservation so the customer can retry until it expires.
    await tx.order.updateMany({ where: { id: payment.orderId, paymentStatus: { in: ['PENDING', 'AUTHORIZED'] } }, data: { paymentStatus: 'FAILED' } });
  });
}

/**
 * Cancels unpaid online orders whose reservation window has passed, releasing stock and coupons.
 * `reconcile` asks the gateway whether a payment actually succeeded before giving up on the order.
 */
export async function expireStaleOrders(reconcile?: (orderId: string) => Promise<boolean>): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING', paymentStatus: { not: 'PAID' }, reservationExpiresAt: { lt: new Date() } },
    select: { id: true, orderNumber: true, userId: true },
    take: 100,
  });
  let expired = 0;
  for (const o of stale) {
    try {
      if (reconcile && (await reconcile(o.id))) continue;
      const done = await prisma.$transaction(async (tx) => {
        const order = await lockOrder(tx, o.id);
        if (order.status !== 'PENDING' || order.paymentStatus === 'PAID') return false;
        await releaseOrderStock(tx, order, 'Payment window expired');
        await releaseCoupon(tx, order.id);
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Payment not completed in time', paymentStatus: 'FAILED' },
        });
        await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: 'Expired' } });
        await addHistory(tx, order.id, 'PENDING', 'CANCELLED', 'Payment not completed in time — reservation released');
        return true;
      });
      if (done) {
        expired++;
        await notifyUser(o.userId, { type: 'ORDER', title: 'Order cancelled', message: `Order ${o.orderNumber} was cancelled because payment was not completed.`, link: `/account/orders/${o.orderNumber}` });
      }
    } catch (error) {
      logger.error('Failed to expire order', { order: o.orderNumber, error: (error as Error).message });
    }
  }
  return expired;
}

// ─────────────────────── Cancel / status ───────────────────────

export async function cancelOrder(orderNumber: string, actor: { userId: string; isAdmin: boolean }, reason: string) {
  const found = await prisma.order.findUnique({ where: { orderNumber } });
  if (!found || (!actor.isAdmin && found.userId !== actor.userId)) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

  const allowed = actor.isAdmin ? ADMIN_CANCELLABLE : CUSTOMER_CANCELLABLE;
  const outcome = await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, found.id);
    if (!allowed.includes(order.status)) {
      throw AppError.unprocessable(`Orders that are ${order.status.toLowerCase().replace(/_/g, ' ')} cannot be cancelled`, 'ORDER_NOT_CANCELLABLE');
    }
    await releaseOrderStock(tx, order, `Cancelled: ${reason}`);
    await releaseCoupon(tx, order.id);
    await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
    await addHistory(tx, order.id, order.status, 'CANCELLED', `${actor.isAdmin ? 'Cancelled by admin' : 'Cancelled by customer'}: ${reason}`, actor.userId);

    let refundCreated = false;
    if (order.paymentStatus === 'PAID') {
      const payment = await tx.payment.findFirst({ where: { orderId: order.id, status: 'PAID' }, orderBy: { createdAt: 'desc' } });
      await tx.refund.create({ data: { orderId: order.id, paymentId: payment?.id, amount: order.grandTotal, reason: `Order cancelled: ${reason}` } });
      refundCreated = true;
    } else {
      await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: 'Order cancelled' } });
    }
    return { order, refundCreated };
  });

  await notifyUser(found.userId, {
    type: 'ORDER',
    title: 'Order cancelled',
    message: `Order ${orderNumber} has been cancelled.${outcome.refundCreated ? ' Your refund has been initiated.' : ''}`,
    link: `/account/orders/${orderNumber}`,
  });
  if (outcome.refundCreated) {
    await notifyAdmins({ type: 'REFUND', title: 'Refund requested', message: `${orderNumber} cancelled — refund ${formatINR(found.grandTotal)}`, link: `/admin/orders/${orderNumber}` });
  }
  void sendOrderEmail(found.id, 'Order cancelled', `Your order has been cancelled.${outcome.refundCreated ? ' Your refund has been initiated and will reach your original payment method in 5–7 business days.' : ''}`);
}

export async function updateOrderStatus(
  orderNumber: string,
  input: { status: OrderStatus; note?: string; trackingNumber?: string; trackingUrl?: string },
  adminId: string,
) {
  if (input.status === 'CANCELLED') {
    await cancelOrder(orderNumber, { userId: adminId, isAdmin: true }, input.note ?? 'Cancelled by store');
    return getOrderForAdmin(orderNumber);
  }

  const found = await prisma.order.findUnique({ where: { orderNumber } });
  if (!found) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, found.id);
    const allowed = allowedAdminTransitions(order.status);
    if (!allowed.includes(input.status)) {
      throw AppError.unprocessable(
        `Cannot change status from ${order.status} to ${input.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        'INVALID_STATUS_TRANSITION',
        { allowed },
      );
    }
    const data: Prisma.OrderUpdateInput = { status: input.status };
    if (input.status === 'SHIPPED') {
      const provider = getShippingProvider(order.shippingProvider);
      const weight = await tx.orderItem.findMany({ where: { orderId: order.id }, include: { product: { select: { weightGrams: true } } } });
      const shipment = await provider.createShipment({
        orderNumber: order.orderNumber,
        pincode: order.shipPincode,
        weightGrams: weight.reduce((s, i) => s + i.product.weightGrams * i.quantity, 0),
        codAmount: order.paymentMethod === 'COD' ? order.grandTotal : 0,
      });
      const trackingNumber = input.trackingNumber ?? shipment.trackingNumber;
      Object.assign(data, {
        shippedAt: new Date(),
        trackingNumber,
        trackingUrl: input.trackingUrl ?? shipment.trackingUrl ?? (trackingNumber ? provider.trackingUrl(trackingNumber) : undefined),
      });
    }
    if (input.status === 'DELIVERED') {
      data.deliveredAt = new Date();
      if (order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID') {
        data.paymentStatus = 'PAID';
        data.paidAt = new Date();
        await tx.payment.updateMany({ where: { orderId: order.id, gateway: 'COD' }, data: { status: 'PAID', paidAt: new Date() } });
      }
    }
    await tx.order.update({ where: { id: order.id }, data });
    await addHistory(tx, order.id, order.status, input.status, input.note, adminId);
  });

  const label = input.status.toLowerCase().replace(/_/g, ' ');
  await notifyUser(found.userId, { type: 'ORDER', title: `Order ${label}`, message: `Your order ${orderNumber} is now ${label}.`, link: `/account/orders/${orderNumber}` });
  if (['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(input.status)) {
    void sendOrderEmail(found.id, `Order ${label}`, `Good news! Your order is now ${label}.`);
  }
  return getOrderForAdmin(orderNumber);
}

// ─────────────────────────── Queries ───────────────────────────

const detailInclude = {
  items: { orderBy: { id: 'asc' as const }, include: { review: { select: { id: true, rating: true, status: true } } } },
  statusHistory: { orderBy: { createdAt: 'asc' as const }, select: { fromStatus: true, toStatus: true, note: true, createdAt: true } },
  payments: {
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, gateway: true, amount: true, currency: true, status: true, gatewayPaymentId: true, failureReason: true, paidAt: true, createdAt: true },
  },
  returns: { orderBy: { createdAt: 'desc' as const } },
  refunds: { orderBy: { createdAt: 'desc' as const }, select: { id: true, amount: true, status: true, reason: true, processedAt: true, createdAt: true, gatewayRefundId: true } },
} satisfies Prisma.OrderInclude;

type OrderDetail = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

async function serializeOrder(order: OrderDetail) {
  const settings = await getSettings();
  const returnDeadline = order.deliveredAt ? new Date(order.deliveredAt.getTime() + settings.returnWindowDays * 86_400_000) : null;
  const { idempotencyKey: _k, couponId: _c, stockReserved: _r, stockCommitted: _sc, ...rest } = order;
  return {
    ...rest,
    items: order.items.map((i) => ({ ...i, gstRate: Number(i.gstRate) })),
    canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
    canReturn: order.status === 'DELIVERED' && returnDeadline !== null && returnDeadline > new Date() && !order.returns.some((r) => r.status !== 'REJECTED'),
    canPay: order.status === 'PENDING' && order.paymentStatus !== 'PAID' && (order.reservationExpiresAt?.getTime() ?? 0) > Date.now(),
    canReview: order.status === 'DELIVERED' || order.status === 'RETURN_REQUESTED',
    returnDeadline,
  };
}

export async function getOrderForCustomer(userId: string, orderNumber: string) {
  const order = await prisma.order.findFirst({ where: { orderNumber, userId }, include: detailInclude });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  return serializeOrder(order);
}

export async function listCustomerOrders(userId: string, page = 1, limit = 10) {
  const p = getPagination(page, limit, 50);
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: p.skip,
      take: p.take,
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        grandTotal: true,
        placedAt: true,
        estimatedDeliveryDate: true,
        items: { select: { productName: true, imageUrl: true, quantity: true, variantName: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, meta: buildMeta(p.page, p.limit, total) };
}

export interface AdminOrderFilters {
  q?: string;
  status?: OrderStatus;
  paymentStatus?: Prisma.EnumPaymentStatusFilter['equals'];
  paymentMethod?: PaymentMethod;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export async function listOrdersForAdmin(f: AdminOrderFilters) {
  const p = getPagination(f.page, f.limit, 100);
  const where: Prisma.OrderWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.paymentStatus ? { paymentStatus: f.paymentStatus } : {}),
    ...(f.paymentMethod ? { paymentMethod: f.paymentMethod } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
    ...(f.q
      ? {
          OR: [
            { orderNumber: { contains: f.q, mode: 'insensitive' } },
            { shipName: { contains: f.q, mode: 'insensitive' } },
            { shipPhone: { contains: f.q } },
            { user: { email: { contains: f.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: p.skip,
      take: p.take,
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        grandTotal: true,
        createdAt: true,
        shipName: true,
        shipCity: true,
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, meta: buildMeta(p.page, p.limit, total) };
}

export async function getOrderForAdmin(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      ...detailInclude,
      user: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      statusHistory: { orderBy: { createdAt: 'asc' }, include: { changedBy: { select: { name: true } } } },
    },
  });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  const base = await serializeOrder(order);
  return { ...base, user: order.user, statusHistory: order.statusHistory, allowedTransitions: allowedAdminTransitions(order.status) };
}
