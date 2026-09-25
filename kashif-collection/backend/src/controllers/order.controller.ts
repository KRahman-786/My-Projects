import type { Request, Response } from 'express';
import * as orderService from '../services/order.service';
import * as returnsService from '../services/returns.service';
import { getInvoiceOrder, renderInvoice } from '../services/invoice.service';
import { currentUser } from '../middleware/auth';
import { parseParams, parseQuery } from '../middleware/validate';
import { paginationQuery } from '../validators/common';
import { orderNumberParam } from '../validators/order.validators';
import { created, ok } from '../utils/response';

export async function createOrder(req: Request, res: Response) {
  const { order, duplicate } = await orderService.createOrder(currentUser(req).id, req.body);
  if (duplicate) {
    ok(res, order, { message: 'Order already placed' });
    return;
  }
  created(res, order, order.paymentMethod === 'COD' ? 'Order placed successfully' : 'Order created. Complete the payment to confirm.');
}

export async function listOrders(req: Request, res: Response) {
  const q = parseQuery(paginationQuery, req);
  const { items, meta } = await orderService.listCustomerOrders(currentUser(req).id, q.page, q.limit);
  ok(res, items, { meta });
}

export async function getOrder(req: Request, res: Response) {
  const { orderNumber } = parseParams(orderNumberParam, req);
  ok(res, await orderService.getOrderForCustomer(currentUser(req).id, orderNumber));
}

export async function cancelOrder(req: Request, res: Response) {
  const { orderNumber } = parseParams(orderNumberParam, req);
  await orderService.cancelOrder(orderNumber, { userId: currentUser(req).id, isAdmin: false }, req.body.reason);
  ok(res, await orderService.getOrderForCustomer(currentUser(req).id, orderNumber), { message: 'Order cancelled' });
}

export async function requestReturn(req: Request, res: Response) {
  const { orderNumber } = parseParams(orderNumberParam, req);
  await returnsService.requestReturn(currentUser(req).id, orderNumber, req.body.reason, req.body.details);
  ok(res, await orderService.getOrderForCustomer(currentUser(req).id, orderNumber), { message: 'Return requested' });
}

/** Streams the PDF invoice. Customers may only download their own; admins any. */
export async function invoice(req: Request, res: Response) {
  const { orderNumber } = parseParams(orderNumberParam, req);
  const user = currentUser(req);
  const order = await getInvoiceOrder(orderNumber, { id: user.id, isAdmin: user.role === 'ADMIN' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download === '0' ? 'inline' : 'attachment'}; filename="Invoice-${orderNumber}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  renderInvoice(order, res);
}
