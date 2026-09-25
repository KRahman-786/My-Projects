import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authRouter, meRouter } from './auth.routes';
import { adminRouter } from './admin.routes';
import * as catalog from '../controllers/catalog.controller';
import * as account from '../controllers/account.controller';
import * as cart from '../controllers/cart.controller';
import * as orders from '../controllers/order.controller';
import * as payments from '../controllers/payment.controller';
import { optionalAuth, requireAuth, currentUser } from '../middleware/auth';
import { validateBody, parseParams } from '../middleware/validate';
import { imageUpload } from '../middleware/upload';
import { sensitiveLimiter } from '../middleware/rateLimit';
import { addressSchema, updateAddressSchema } from '../validators/address.validators';
import { addCartItemSchema, couponCodeSchema, mergeCartSchema, quoteSchema, updateCartItemSchema, validateCouponSchema } from '../validators/cart.validators';
import {
  cancelOrderSchema,
  createOrderSchema,
  razorpayCreateSchema,
  razorpayFailureSchema,
  razorpayVerifySchema,
  returnRequestSchema,
  stripeCreateSchema,
} from '../validators/order.validators';
import { createReviewSchema } from '../validators/review.validators';
import { contactSchema } from '../validators/admin.validators';
import { pincodeSchema } from '../validators/common';
import { getPublicSettings } from '../services/settings.service';
import { checkPincode } from '../services/shipping/shipping.service';
import { submitContactMessage } from '../services/contact.service';
import { uploadImage } from '../services/storage.service';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';
import { created, ok } from '../utils/response';

export const apiRouter = Router();

apiRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    ok(res, { status: 'ok', database: 'up', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ success: false, message: 'Database unavailable', errorCode: 'DB_UNAVAILABLE' });
  }
});

// Auth & profile
apiRouter.use('/auth', authRouter);
apiRouter.use('/me', meRouter);

// Catalogue (public)
apiRouter.get('/home', catalog.home);
apiRouter.get('/categories', catalog.listCategories);
apiRouter.get('/categories/:slug', catalog.getCategory);
apiRouter.get('/products', catalog.listProducts);
apiRouter.get('/products/facets', catalog.facets);
apiRouter.get('/products/:slug', catalog.getProduct);
apiRouter.get('/products/:slug/related', catalog.relatedProducts);
apiRouter.get('/products/:slug/reviews', catalog.productReviews);
apiRouter.get('/search/suggestions', catalog.suggestions);
apiRouter.get('/offers', catalog.offers);
apiRouter.get('/sitemap-data', catalog.productSlugs);

// Store info
apiRouter.get('/settings/public', async (_req: Request, res: Response) => ok(res, await getPublicSettings()));
apiRouter.get('/shipping/pincode/:pincode', async (req: Request, res: Response) => {
  const { pincode } = parseParams(z.object({ pincode: pincodeSchema }), req);
  ok(res, await checkPincode(pincode));
});
apiRouter.post('/contact', sensitiveLimiter, validateBody(contactSchema), async (req: Request, res: Response) => {
  created(res, await submitContactMessage(req.body), 'Thanks for reaching out! We will get back to you within 24 hours.');
});

// Addresses
apiRouter.get('/addresses', requireAuth, account.listAddresses);
apiRouter.post('/addresses', requireAuth, validateBody(addressSchema), account.createAddress);
apiRouter.patch('/addresses/:id', requireAuth, validateBody(updateAddressSchema), account.updateAddress);
apiRouter.post('/addresses/:id/default', requireAuth, account.setDefaultAddress);
apiRouter.delete('/addresses/:id', requireAuth, account.deleteAddress);

// Notifications
apiRouter.get('/notifications', requireAuth, account.notifications);
apiRouter.post('/notifications/read', requireAuth, account.readNotifications);

// Cart
apiRouter.post('/cart/quote', optionalAuth, validateBody(quoteSchema), cart.quote);
apiRouter.get('/cart', requireAuth, cart.getCart);
apiRouter.delete('/cart', requireAuth, cart.clearCart);
apiRouter.post('/cart/items', requireAuth, validateBody(addCartItemSchema), cart.addItem);
apiRouter.patch('/cart/items/:id', requireAuth, validateBody(updateCartItemSchema), cart.updateItem);
apiRouter.delete('/cart/items/:id', requireAuth, cart.removeItem);
apiRouter.post('/cart/merge', requireAuth, validateBody(mergeCartSchema), cart.mergeCart);
apiRouter.post('/cart/coupon', requireAuth, validateBody(couponCodeSchema), cart.applyCoupon);
apiRouter.delete('/cart/coupon', requireAuth, cart.removeCoupon);
apiRouter.post('/coupons/validate', optionalAuth, validateBody(validateCouponSchema), cart.validateCoupon);

// Wishlist
apiRouter.get('/wishlist', requireAuth, cart.getWishlist);
apiRouter.get('/wishlist/ids', requireAuth, cart.wishlistIds);
apiRouter.post('/wishlist', requireAuth, validateBody(cart.wishlistAddSchema), cart.addWishlist);
apiRouter.delete('/wishlist/:id', requireAuth, cart.removeWishlist);
apiRouter.post('/wishlist/:id/move-to-cart', requireAuth, validateBody(cart.moveToCartSchema), cart.moveToCart);

// Orders
apiRouter.post('/orders', requireAuth, validateBody(createOrderSchema), orders.createOrder);
apiRouter.get('/orders', requireAuth, orders.listOrders);
apiRouter.get('/orders/:orderNumber', requireAuth, orders.getOrder);
apiRouter.post('/orders/:orderNumber/cancel', requireAuth, validateBody(cancelOrderSchema), orders.cancelOrder);
apiRouter.post('/orders/:orderNumber/return', requireAuth, validateBody(returnRequestSchema), orders.requestReturn);
apiRouter.get('/orders/:orderNumber/invoice', requireAuth, orders.invoice);

// Payments
apiRouter.get('/payments/config', payments.config);
apiRouter.post('/payments/razorpay/create', requireAuth, validateBody(razorpayCreateSchema), payments.razorpayCreate);
apiRouter.post('/payments/razorpay/verify', requireAuth, validateBody(razorpayVerifySchema), payments.razorpayVerify);
apiRouter.post('/payments/razorpay/failed', requireAuth, validateBody(razorpayFailureSchema), payments.razorpayFailed);
apiRouter.post('/payments/razorpay/webhook', payments.razorpayWebhook);
apiRouter.post('/payments/stripe/create', requireAuth, validateBody(stripeCreateSchema), payments.stripeCreate);
apiRouter.post('/payments/stripe/confirm', requireAuth, validateBody(stripeCreateSchema), payments.stripeConfirm);
apiRouter.post('/payments/stripe/webhook', payments.stripeWebhook);

// Reviews
apiRouter.post('/reviews', requireAuth, validateBody(createReviewSchema), account.createReview);
apiRouter.get('/reviews/mine', requireAuth, account.myReviews);
apiRouter.post('/uploads/review-image', requireAuth, sensitiveLimiter, imageUpload.single('image'), async (req: Request, res: Response) => {
  currentUser(req);
  if (!req.file) throw AppError.badRequest('No image uploaded', 'NO_FILES');
  created(res, await uploadImage(req.file.buffer, 'reviews'));
});

// Admin
apiRouter.use('/admin', adminRouter);
