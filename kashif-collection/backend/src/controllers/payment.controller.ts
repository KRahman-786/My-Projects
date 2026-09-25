import type { Request, Response } from 'express';
import * as paymentService from '../services/payments/payment.service';
import { currentUser } from '../middleware/auth';
import { ok } from '../utils/response';

export async function config(_req: Request, res: Response) {
  ok(res, paymentService.publicPaymentConfig());
}

export async function razorpayCreate(req: Request, res: Response) {
  ok(res, await paymentService.createRazorpayPayment(currentUser(req).id, req.body.orderNumber));
}

export async function razorpayVerify(req: Request, res: Response) {
  const result = await paymentService.verifyRazorpayPayment(currentUser(req).id, req.body);
  ok(res, result, { message: 'Payment verified' });
}

export async function razorpayFailed(req: Request, res: Response) {
  await paymentService.reportRazorpayFailure(currentUser(req).id, req.body);
  ok(res, null, { message: 'Payment marked as failed. You can retry before the order expires.' });
}

export async function razorpayWebhook(req: Request, res: Response) {
  const result = await paymentService.handleRazorpayWebhook(
    req.rawBody,
    req.header('x-razorpay-signature') ?? undefined,
    req.header('x-razorpay-event-id') ?? undefined,
  );
  ok(res, result);
}

export async function stripeCreate(req: Request, res: Response) {
  ok(res, await paymentService.createStripePayment(currentUser(req).id, req.body.orderNumber));
}

export async function stripeConfirm(req: Request, res: Response) {
  ok(res, await paymentService.confirmStripePayment(currentUser(req).id, req.body.orderNumber));
}

export async function stripeWebhook(req: Request, res: Response) {
  const result = await paymentService.handleStripeWebhook(req.rawBody, req.header('stripe-signature') ?? undefined);
  ok(res, result);
}
