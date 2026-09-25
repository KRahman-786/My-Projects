import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { buildMeta, getPagination } from '../utils/pagination';
import { formatINR } from '../utils/money';
import { restock } from './inventory.service';
import { getSettings } from './settings.service';
import { notifyAdmins, notifyUser } from './notification.service';
import { getRazorpayClient } from './payments/razorpay.gateway';
import { getStripeClient } from './payments/stripe.gateway';

// ─────────────────────────── Returns ───────────────────────────

export async function requestReturn(userId: string, orderNumber: string, reason: string, details?: string) {
  const order = await prisma.order.findFirst({ where: { orderNumber, userId }, include: { returns: true } });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  if (order.status !== 'DELIVERED' || !order.deliveredAt) throw AppError.unprocessable('Only delivered orders can be returned', 'RETURN_NOT_ALLOWED');
  const { returnWindowDays } = await getSettings();
  if (order.deliveredAt.getTime() + returnWindowDays * 86_400_000 < Date.now()) {
    throw AppError.unprocessable(`The ${returnWindowDays}-day return window for this order has closed`, 'RETURN_WINDOW_CLOSED');
  }
  if (order.returns.some((r) => r.status !== 'REJECTED')) throw AppError.conflict('A return request already exists for this order', 'RETURN_EXISTS');

  const ret = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({ where: { id: order.id, status: 'DELIVERED' }, data: { status: 'RETURN_REQUESTED' } });
    if (updated.count === 0) throw AppError.conflict('Order status changed, please refresh', 'ORDER_STATE_CHANGED');
    await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: 'DELIVERED', toStatus: 'RETURN_REQUESTED', note: reason, changedById: userId } });
    return tx.return.create({ data: { orderId: order.id, userId, reason, details } });
  });
  await notifyAdmins({ type: 'RETURN', title: 'Return requested', message: `${orderNumber}: ${reason}`, link: `/admin/orders/${orderNumber}` });
  return ret;
}

export async function listReturns(status: string | undefined, page = 1, limit = 20) {
  const p = getPagination(page, limit);
  const where = status ? { status: status as never } : {};
  const [items, total] = await Promise.all([
    prisma.return.findMany({
      where,
      skip: p.skip,
      take: p.take,
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true, grandTotal: true, paymentMethod: true } }, user: { select: { name: true, email: true } } },
    }),
    prisma.return.count({ where }),
  ]);
  return { items, meta: buildMeta(p.page, p.limit, total) };
}

/** APPROVE → customer ships item back; REJECT → order back to DELIVERED; RECEIVE → restock + refund created. */
export async function resolveReturn(returnId: string, action: 'APPROVE' | 'REJECT' | 'RECEIVE', adminId: string, note?: string) {
  const ret = await prisma.return.findUnique({ where: { id: returnId }, include: { order: true } });
  if (!ret) throw AppError.notFound('Return not found', 'RETURN_NOT_FOUND');
  const order = ret.order;

  await prisma.$transaction(async (tx) => {
    if (action === 'APPROVE') {
      if (ret.status !== 'REQUESTED') throw AppError.unprocessable('Only new requests can be approved', 'INVALID_RETURN_STATE');
      await tx.return.update({ where: { id: ret.id }, data: { status: 'APPROVED', adminNote: note } });
    } else if (action === 'REJECT') {
      if (!['REQUESTED', 'APPROVED'].includes(ret.status)) throw AppError.unprocessable('This return can no longer be rejected', 'INVALID_RETURN_STATE');
      await tx.return.update({ where: { id: ret.id }, data: { status: 'REJECTED', adminNote: note, resolvedAt: new Date() } });
      await tx.order.update({ where: { id: order.id }, data: { status: 'DELIVERED' } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: 'DELIVERED', note: `Return rejected${note ? `: ${note}` : ''}`, changedById: adminId } });
    } else {
      if (!['REQUESTED', 'APPROVED'].includes(ret.status)) throw AppError.unprocessable('This return has already been received', 'INVALID_RETURN_STATE');
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const i of items) {
        await restock(tx, i.variantId, i.quantity, 'RETURN', { orderId: order.id, reason: `Return ${order.orderNumber}`, performedById: adminId });
        await tx.product.update({ where: { id: i.productId }, data: { soldCount: { decrement: i.quantity } } });
      }
      await tx.return.update({ where: { id: ret.id }, data: { status: 'RECEIVED', adminNote: note } });
      await tx.order.update({ where: { id: order.id }, data: { status: 'RETURNED', stockCommitted: false } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: 'RETURNED', note: note ?? 'Returned items received', changedById: adminId } });
      const payment = await tx.payment.findFirst({ where: { orderId: order.id, status: 'PAID' }, orderBy: { createdAt: 'desc' } });
      // Shipping and COD fees are non-refundable on returns.
      const amount = order.grandTotal - order.shippingFee - order.codFee;
      await tx.refund.create({ data: { orderId: order.id, paymentId: payment?.id, returnId: ret.id, amount, reason: `Return: ${ret.reason}` } });
    }
  });

  const messages = { APPROVE: 'approved — please keep the items ready for pickup', REJECT: 'was not approved', RECEIVE: 'received — your refund is being processed' };
  await notifyUser(ret.userId, { type: 'RETURN', title: 'Return update', message: `Your return for ${order.orderNumber} ${messages[action]}.`, link: `/account/orders/${order.orderNumber}` });
}

// ─────────────────────────── Refunds ───────────────────────────

export async function listRefunds(status: string | undefined, page = 1, limit = 20) {
  const p = getPagination(page, limit);
  const where = status ? { status: status as never } : {};
  const [items, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      skip: p.skip,
      take: p.take,
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true, paymentMethod: true, user: { select: { name: true, email: true } } } }, payment: { select: { gateway: true, gatewayPaymentId: true } } },
    }),
    prisma.refund.count({ where }),
  ]);
  return { items, meta: buildMeta(p.page, p.limit, total) };
}

/**
 * Executes a refund through the original gateway (Razorpay / Stripe). COD refunds are settled offline
 * (bank transfer / UPI) and recorded here with the admin's reference.
 */
export async function processRefund(refundId: string, adminId: string, manualReference?: string) {
  const refund = await prisma.refund.findUnique({ where: { id: refundId }, include: { payment: true, order: true } });
  if (!refund) throw AppError.notFound('Refund not found', 'REFUND_NOT_FOUND');
  if (refund.status === 'PROCESSED') throw AppError.conflict('This refund has already been processed', 'REFUND_ALREADY_PROCESSED');

  // Claim the refund so two admins cannot trigger the gateway twice.
  const claimed = await prisma.refund.updateMany({ where: { id: refund.id, status: { in: ['PENDING', 'FAILED'] }, gatewayRefundId: null }, data: { gatewayRefundId: 'IN_PROGRESS' } });
  if (claimed.count === 0) throw AppError.conflict('This refund is already being processed', 'REFUND_IN_PROGRESS');

  let gatewayRefundId: string;
  try {
    const payment = refund.payment;
    if (payment?.gateway === 'RAZORPAY' && payment.gatewayPaymentId) {
      gatewayRefundId = (await getRazorpayClient().refund(payment.gatewayPaymentId, refund.amount, { orderNumber: refund.order.orderNumber })).id;
    } else if (payment?.gateway === 'STRIPE' && payment.gatewayOrderId) {
      gatewayRefundId = (await getStripeClient().refund(payment.gatewayOrderId, refund.amount)).id;
    } else {
      if (!manualReference) throw AppError.badRequest('Enter the bank/UPI transaction reference for this manual refund', 'MANUAL_REFERENCE_REQUIRED');
      gatewayRefundId = `MANUAL:${manualReference}`;
    }
  } catch (error) {
    await prisma.refund.update({ where: { id: refund.id }, data: { status: 'FAILED', gatewayRefundId: null } });
    if (error instanceof AppError) throw error;
    logger.error('Gateway refund failed', { refundId, error: (error as Error).message });
    throw AppError.serviceUnavailable(`Refund failed at the payment gateway: ${(error as Error).message}`, 'REFUND_GATEWAY_ERROR');
  }

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSED', gatewayRefundId, processedAt: new Date() } });
    if (refund.paymentId) await tx.payment.update({ where: { id: refund.paymentId }, data: { status: 'REFUNDED' } });
    const order = await tx.order.findUniqueOrThrow({ where: { id: refund.orderId } });
    const openRefunds = await tx.refund.count({ where: { orderId: order.id, status: { not: 'PROCESSED' } } });
    if (openRefunds === 0) {
      const toRefunded = ['CANCELLED', 'RETURNED'].includes(order.status);
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'REFUNDED', ...(toRefunded ? { status: 'REFUNDED' } : {}) } });
      if (toRefunded) {
        await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: 'REFUNDED', note: `Refund ${formatINR(refund.amount)} processed`, changedById: adminId } });
      }
    }
    if (refund.returnId) await tx.return.update({ where: { id: refund.returnId }, data: { status: 'COMPLETED', resolvedAt: new Date() } });
  });

  await notifyUser(refund.order.userId, {
    type: 'REFUND',
    title: 'Refund processed',
    message: `${formatINR(refund.amount)} for order ${refund.order.orderNumber} has been refunded. It may take 5–7 business days to reflect.`,
    link: `/account/orders/${refund.order.orderNumber}`,
  });
}
