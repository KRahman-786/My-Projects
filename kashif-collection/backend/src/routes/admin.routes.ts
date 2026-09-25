import { Router } from 'express';
import * as c from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { imageUpload } from '../middleware/upload';
import { createProductSchema, updateProductSchema } from '../validators/product.validators';
import { categorySchema, subcategorySchema, updateCategorySchema, updateSubcategorySchema } from '../validators/category.validators';
import { processRefundSchema, resolveReturnSchema, updateStatusSchema } from '../validators/order.validators';
import { reviewStatusSchema } from '../validators/review.validators';
import { activeSchema, adjustInventorySchema, couponSchema, pincodeOverrideSchema, settingsSchema, updateCouponSchema } from '../validators/admin.validators';
import { z } from 'zod';

export const adminRouter = Router();
// Every admin endpoint requires an authenticated ADMIN.
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/dashboard', c.dashboard);

adminRouter.get('/products', c.listProducts);
adminRouter.post('/products', validateBody(createProductSchema), c.createProduct);
adminRouter.get('/products/:id', c.getProduct);
adminRouter.patch('/products/:id', validateBody(updateProductSchema), c.updateProduct);
adminRouter.patch('/products/:id/status', validateBody(activeSchema), c.setProductActive);
adminRouter.delete('/products/:id', c.deleteProduct);

adminRouter.get('/categories', c.listCategories);
adminRouter.post('/categories', validateBody(categorySchema), c.createCategory);
adminRouter.patch('/categories/:id', validateBody(updateCategorySchema), c.updateCategory);
adminRouter.delete('/categories/:id', c.deleteCategory);
adminRouter.post('/subcategories', validateBody(subcategorySchema), c.createSubcategory);
adminRouter.patch('/subcategories/:id', validateBody(updateSubcategorySchema), c.updateSubcategory);
adminRouter.delete('/subcategories/:id', c.deleteSubcategory);

adminRouter.get('/orders', c.listOrders);
adminRouter.get('/orders/:orderNumber', c.getOrder);
adminRouter.patch('/orders/:orderNumber/status', validateBody(updateStatusSchema), c.updateOrderStatus);

adminRouter.get('/returns', c.listReturns);
adminRouter.patch('/returns/:id', validateBody(resolveReturnSchema), c.resolveReturn);
adminRouter.get('/refunds', c.listRefunds);
adminRouter.post('/refunds/:id/process', validateBody(processRefundSchema), c.processRefund);

adminRouter.get('/customers', c.listCustomers);
adminRouter.get('/customers/:id', c.getCustomer);
adminRouter.patch('/customers/:id/status', validateBody(activeSchema), c.setCustomerActive);

adminRouter.get('/inventory', c.listInventory);
adminRouter.post('/inventory/adjust', validateBody(adjustInventorySchema), c.adjustInventory);
adminRouter.get('/inventory/:id/history', c.inventoryHistory);

adminRouter.get('/coupons', c.listCoupons);
adminRouter.post('/coupons', validateBody(couponSchema), c.createCoupon);
adminRouter.patch('/coupons/:id', validateBody(updateCouponSchema), c.updateCoupon);
adminRouter.delete('/coupons/:id', c.deleteCoupon);

adminRouter.get('/reviews', c.listReviews);
adminRouter.patch('/reviews/:id', validateBody(reviewStatusSchema), c.setReviewStatus);
adminRouter.delete('/reviews/:id', c.deleteReview);

adminRouter.get('/settings', c.getSettings);
adminRouter.patch('/settings', validateBody(settingsSchema), c.updateSettings);
adminRouter.get('/pincodes', c.listPincodes);
adminRouter.put('/pincodes', validateBody(pincodeOverrideSchema), c.upsertPincode);
adminRouter.delete('/pincodes/:pincode', c.deletePincode);

adminRouter.post('/uploads', imageUpload.array('images', 10), c.uploadImages);

adminRouter.get('/messages', c.listMessages);
adminRouter.patch('/messages/:id', validateBody(z.object({ isHandled: z.boolean() })), c.markMessage);
adminRouter.get('/notifications', c.notifications);
adminRouter.post('/notifications/read', c.readNotifications);
