import type { Request, Response } from 'express';
import * as addressService from '../services/address.service';
import * as notificationService from '../services/notification.service';
import * as reviewService from '../services/review.service';
import { currentUser } from '../middleware/auth';
import { parseParams } from '../middleware/validate';
import { idParam } from '../validators/common';
import { created, ok } from '../utils/response';

export async function listAddresses(req: Request, res: Response) {
  ok(res, await addressService.listAddresses(currentUser(req).id));
}
export async function createAddress(req: Request, res: Response) {
  created(res, await addressService.createAddress(currentUser(req).id, req.body), 'Address saved');
}
export async function updateAddress(req: Request, res: Response) {
  const { id } = parseParams(idParam, req);
  ok(res, await addressService.updateAddress(currentUser(req).id, id, req.body), { message: 'Address updated' });
}
export async function setDefaultAddress(req: Request, res: Response) {
  const { id } = parseParams(idParam, req);
  ok(res, await addressService.setDefaultAddress(currentUser(req).id, id), { message: 'Default address updated' });
}
export async function deleteAddress(req: Request, res: Response) {
  const { id } = parseParams(idParam, req);
  await addressService.deleteAddress(currentUser(req).id, id);
  ok(res, null, { message: 'Address deleted' });
}

export async function notifications(req: Request, res: Response) {
  ok(res, await notificationService.listUserNotifications(currentUser(req).id));
}
export async function readNotifications(req: Request, res: Response) {
  await notificationService.markNotificationsRead(currentUser(req).id);
  ok(res, null);
}

export async function myReviews(req: Request, res: Response) {
  ok(res, await reviewService.myReviews(currentUser(req).id));
}
export async function createReview(req: Request, res: Response) {
  const review = await reviewService.createReview(currentUser(req).id, req.body);
  created(res, review, review.status === 'APPROVED' ? 'Thanks! Your review is live.' : 'Thanks! Your review will appear after moderation.');
}
