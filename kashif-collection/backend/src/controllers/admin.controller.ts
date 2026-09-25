import type { Request, Response } from 'express';
import { getDashboard } from '../services/dashboard.service';
import * as productService from '../services/product.service';
import * as categoryService from '../services/category.service';
import * as orderService from '../services/order.service';
import * as returnsService from '../services/returns.service';
import * as customerService from '../services/customer.service';
import * as inventoryService from '../services/inventory.service';
import * as couponService from '../services/coupon.service';
import * as reviewService from '../services/review.service';
import * as settingsService from '../services/settings.service';
import * as contactService from '../services/contact.service';
import * as notificationService from '../services/notification.service';
import { deleteImage, uploadImage } from '../services/storage.service';
import { prisma } from '../config/prisma';
import { currentUser } from '../middleware/auth';
import { parseParams, parseQuery } from '../middleware/validate';
import { idParam } from '../validators/common';
import { adminProductListQuery } from '../validators/product.validators';
import { adminOrderQuery, orderNumberParam } from '../validators/order.validators';
import { adminReviewQuery } from '../validators/review.validators';
import { customerQuery, inventoryQuery, listQuery } from '../validators/admin.validators';
import { AppError } from '../utils/AppError';
import { created, ok } from '../utils/response';
import { z } from 'zod';

export async function dashboard(_req: Request, res: Response) {
  ok(res, await getDashboard());
}

// Products
export async function listProducts(req: Request, res: Response) {
  const { items, meta } = await productService.adminListProducts(parseQuery(adminProductListQuery, req));
  ok(res, items, { meta });
}
export async function getProduct(req: Request, res: Response) {
  ok(res, await productService.adminGetProduct(parseParams(idParam, req).id));
}
export async function createProduct(req: Request, res: Response) {
  const settings = await settingsService.getSettings();
  created(res, await productService.createProduct(req.body, currentUser(req).id, settings.defaultLowStockThreshold), 'Product created');
}
export async function updateProduct(req: Request, res: Response) {
  const settings = await settingsService.getSettings();
  ok(res, await productService.updateProduct(parseParams(idParam, req).id, req.body, currentUser(req).id, settings.defaultLowStockThreshold), { message: 'Product updated' });
}
export async function setProductActive(req: Request, res: Response) {
  ok(res, await productService.setProductActive(parseParams(idParam, req).id, req.body.isActive), { message: 'Product status updated' });
}
export async function deleteProduct(req: Request, res: Response) {
  await productService.deleteProduct(parseParams(idParam, req).id);
  ok(res, null, { message: 'Product deleted (archived — order history is preserved)' });
}

// Categories
export async function listCategories(_req: Request, res: Response) {
  ok(res, await categoryService.listCategories(true));
}
export async function createCategory(req: Request, res: Response) {
  created(res, await categoryService.createCategory(req.body), 'Category created');
}
export async function updateCategory(req: Request, res: Response) {
  ok(res, await categoryService.updateCategory(parseParams(idParam, req).id, req.body), { message: 'Category updated' });
}
export async function deleteCategory(req: Request, res: Response) {
  await categoryService.deleteCategory(parseParams(idParam, req).id);
  ok(res, null, { message: 'Category deleted' });
}
export async function createSubcategory(req: Request, res: Response) {
  created(res, await categoryService.createSubcategory(req.body), 'Subcategory created');
}
export async function updateSubcategory(req: Request, res: Response) {
  ok(res, await categoryService.updateSubcategory(parseParams(idParam, req).id, req.body), { message: 'Subcategory updated' });
}
export async function deleteSubcategory(req: Request, res: Response) {
  await categoryService.deleteSubcategory(parseParams(idParam, req).id);
  ok(res, null, { message: 'Subcategory deleted' });
}

// Orders
export async function listOrders(req: Request, res: Response) {
  const { items, meta } = await orderService.listOrdersForAdmin(parseQuery(adminOrderQuery, req));
  ok(res, items, { meta });
}
export async function getOrder(req: Request, res: Response) {
  ok(res, await orderService.getOrderForAdmin(parseParams(orderNumberParam, req).orderNumber));
}
export async function updateOrderStatus(req: Request, res: Response) {
  const { orderNumber } = parseParams(orderNumberParam, req);
  ok(res, await orderService.updateOrderStatus(orderNumber, req.body, currentUser(req).id), { message: 'Order status updated' });
}

// Returns & refunds
export async function listReturns(req: Request, res: Response) {
  const q = parseQuery(listQuery, req);
  const { items, meta } = await returnsService.listReturns(q.status, q.page, q.limit);
  ok(res, items, { meta });
}
export async function resolveReturn(req: Request, res: Response) {
  await returnsService.resolveReturn(parseParams(idParam, req).id, req.body.action, currentUser(req).id, req.body.note);
  ok(res, null, { message: 'Return updated' });
}
export async function listRefunds(req: Request, res: Response) {
  const q = parseQuery(listQuery, req);
  const { items, meta } = await returnsService.listRefunds(q.status, q.page, q.limit);
  ok(res, items, { meta });
}
export async function processRefund(req: Request, res: Response) {
  await returnsService.processRefund(parseParams(idParam, req).id, currentUser(req).id, req.body.manualReference);
  ok(res, null, { message: 'Refund processed' });
}

// Customers
export async function listCustomers(req: Request, res: Response) {
  const { items, meta } = await customerService.listCustomers(parseQuery(customerQuery, req));
  ok(res, items, { meta });
}
export async function getCustomer(req: Request, res: Response) {
  ok(res, await customerService.getCustomer(parseParams(idParam, req).id));
}
export async function setCustomerActive(req: Request, res: Response) {
  ok(res, await customerService.setCustomerActive(parseParams(idParam, req).id, req.body.isActive), {
    message: req.body.isActive ? 'Customer activated' : 'Customer deactivated',
  });
}

// Inventory
export async function listInventory(req: Request, res: Response) {
  const { items, meta } = await inventoryService.listInventory(parseQuery(inventoryQuery, req));
  ok(res, items, { meta });
}
export async function adjustInventory(req: Request, res: Response) {
  ok(res, await inventoryService.adjustStock({ ...req.body, performedById: currentUser(req).id }), { message: 'Stock updated' });
}
export async function inventoryHistory(req: Request, res: Response) {
  const q = parseQuery(listQuery, req);
  const { items, meta, inventory } = await inventoryService.stockHistory(parseParams(idParam, req).id, q.page, q.limit);
  ok(res, { inventory, items }, { meta });
}

// Coupons
export async function listCoupons(req: Request, res: Response) {
  const q = parseQuery(listQuery, req);
  const { items, meta } = await couponService.adminListCoupons(q.page, q.limit);
  ok(res, items, { meta });
}
export async function createCoupon(req: Request, res: Response) {
  created(res, await couponService.createCoupon(req.body), 'Coupon created');
}
export async function updateCoupon(req: Request, res: Response) {
  ok(res, await couponService.updateCoupon(parseParams(idParam, req).id, req.body), { message: 'Coupon updated' });
}
export async function deleteCoupon(req: Request, res: Response) {
  await couponService.deleteCoupon(parseParams(idParam, req).id);
  ok(res, null, { message: 'Coupon deleted' });
}

// Reviews
export async function listReviews(req: Request, res: Response) {
  const q = parseQuery(adminReviewQuery, req);
  const { items, meta } = await reviewService.adminListReviews(q.status, q.page, q.limit);
  ok(res, items, { meta });
}
export async function setReviewStatus(req: Request, res: Response) {
  ok(res, await reviewService.setReviewStatus(parseParams(idParam, req).id, req.body.status), { message: 'Review updated' });
}
export async function deleteReview(req: Request, res: Response) {
  const review = await reviewService.deleteReview(parseParams(idParam, req).id);
  await deleteImage(review.imagePublicId);
  ok(res, null, { message: 'Review deleted' });
}

// Settings
export async function getSettings(_req: Request, res: Response) {
  ok(res, await settingsService.getSettings());
}
export async function updateSettings(req: Request, res: Response) {
  const body = req.body as { codMinOrderValue?: number; codMaxOrderValue?: number };
  const current = await settingsService.getSettings();
  if ((body.codMinOrderValue ?? current.codMinOrderValue) > (body.codMaxOrderValue ?? current.codMaxOrderValue)) {
    throw AppError.badRequest('COD minimum cannot exceed COD maximum', 'INVALID_SETTINGS');
  }
  ok(res, await settingsService.updateSettings(req.body), { message: 'Settings saved' });
}
export async function listPincodes(_req: Request, res: Response) {
  ok(res, await prisma.serviceablePincode.findMany({ orderBy: { pincode: 'asc' }, take: 1000 }));
}
export async function upsertPincode(req: Request, res: Response) {
  const { pincode, ...data } = req.body;
  ok(res, await prisma.serviceablePincode.upsert({ where: { pincode }, update: data, create: { pincode, ...data } }), { message: 'Pincode saved' });
}
export async function deletePincode(req: Request, res: Response) {
  const { pincode } = parseParams(z.object({ pincode: z.string().regex(/^\d{6}$/) }), req);
  await prisma.serviceablePincode.deleteMany({ where: { pincode } });
  ok(res, null, { message: 'Pincode override removed' });
}

// Uploads
export async function uploadImages(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw AppError.badRequest('No images uploaded', 'NO_FILES');
  const folder = parseQuery(z.object({ folder: z.enum(['products', 'categories']).default('products') }), req).folder;
  const images = [];
  for (const f of files) images.push(await uploadImage(f.buffer, folder));
  created(res, images, `${images.length} image(s) uploaded`);
}

// Messages & notifications
export async function listMessages(req: Request, res: Response) {
  const q = parseQuery(listQuery, req);
  const { items, meta } = await contactService.listContactMessages(q.page, q.limit);
  ok(res, items, { meta });
}
export async function markMessage(req: Request, res: Response) {
  ok(res, await contactService.markContactHandled(parseParams(idParam, req).id, Boolean(req.body.isHandled)));
}
export async function notifications(_req: Request, res: Response) {
  ok(res, await notificationService.listAdminNotifications());
}
export async function readNotifications(_req: Request, res: Response) {
  await notificationService.markAdminNotificationsRead();
  ok(res, null);
}
