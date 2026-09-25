import { api, apiRequest } from '@/lib/api';
import type { Address, Notification, Order, OrderSummaryRow, PaymentConfig, PublicSettings, Quote, Serviceability, User } from '@/types';

export const auth = {
  me: () => api<{ user: User }>('/me').then((d) => d.user),
  session: () => api<{ user: User | null }>('/auth/session').then((d) => d.user),
  login: (body: { email: string; password: string }) => api<{ user: User }>('/auth/login', { method: 'POST', body }),
  register: (body: { name: string; email: string; phone?: string; password: string }) => api<{ user: User }>('/auth/register', { method: 'POST', body }),
  logout: () => api<null>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) => apiRequest<null>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token: string, password: string) => apiRequest<null>('/auth/reset-password', { method: 'POST', body: { token, password } }),
  updateProfile: (body: { name?: string; phone?: string | null }) => api<{ user: User }>('/me', { method: 'PATCH', body }),
  changePassword: (body: { currentPassword: string; newPassword: string }) => apiRequest<null>('/me/change-password', { method: 'POST', body }),
};

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };

export const addresses = {
  list: () => api<Address[]>('/addresses'),
  create: (body: AddressInput) => api<Address>('/addresses', { method: 'POST', body }),
  update: (id: string, body: Partial<AddressInput>) => api<Address>(`/addresses/${id}`, { method: 'PATCH', body }),
  setDefault: (id: string) => api<Address>(`/addresses/${id}/default`, { method: 'POST' }),
  remove: (id: string) => api<null>(`/addresses/${id}`, { method: 'DELETE' }),
};

export interface CartOptions {
  pincode?: string;
  state?: string;
  paymentMethod?: string;
}

export const cartApi = {
  get: (opts: CartOptions = {}) => api<Quote>('/cart', { query: { ...opts } }),
  add: (variantId: string, quantity: number) => api<Quote>('/cart/items', { method: 'POST', body: { variantId, quantity } }),
  update: (itemId: string, quantity: number) => api<Quote>(`/cart/items/${itemId}`, { method: 'PATCH', body: { quantity } }),
  remove: (itemId: string) => api<Quote>(`/cart/items/${itemId}`, { method: 'DELETE' }),
  applyCoupon: (code: string) => api<Quote>('/cart/coupon', { method: 'POST', body: { code } }),
  removeCoupon: () => api<Quote>('/cart/coupon', { method: 'DELETE' }),
  merge: (items: { variantId: string; quantity: number }[]) => api<Quote>('/cart/merge', { method: 'POST', body: { items } }),
  quote: (items: { variantId: string; quantity: number }[], couponCode?: string) => api<Quote>('/cart/quote', { method: 'POST', body: { items, couponCode } }),
};

export const wishlistApi = {
  list: () => api<{ id: string; variantId: string | null; addedAt: string; product: import('@/types').ProductCard }[]>('/wishlist'),
  ids: () => api<string[]>('/wishlist/ids'),
  add: (productId: string, variantId?: string) => api<null>('/wishlist', { method: 'POST', body: { productId, variantId } }),
  remove: (productId: string) => api<null>(`/wishlist/${productId}`, { method: 'DELETE' }),
  moveToCart: (productId: string, variantId?: string) => api<null>(`/wishlist/${productId}/move-to-cart`, { method: 'POST', body: { variantId } }),
};

export const ordersApi = {
  create: (body: { addressId: string; paymentMethod: string; couponCode?: string | null; customerNote?: string; idempotencyKey: string; expectedTotal?: number }) =>
    apiRequest<Order>('/orders', { method: 'POST', body }),
  list: (page = 1) => apiRequest<OrderSummaryRow[]>('/orders', { query: { page, limit: 10 } }),
  get: (orderNumber: string) => api<Order>(`/orders/${orderNumber}`),
  cancel: (orderNumber: string, reason: string) => api<Order>(`/orders/${orderNumber}/cancel`, { method: 'POST', body: { reason } }),
  requestReturn: (orderNumber: string, reason: string, details?: string) => api<Order>(`/orders/${orderNumber}/return`, { method: 'POST', body: { reason, details } }),
  invoiceUrl: (orderNumber: string) => `${process.env.NEXT_PUBLIC_API_URL || '/api'}/orders/${orderNumber}/invoice`,
};

export const paymentsApi = {
  config: () => api<PaymentConfig>('/payments/config'),
  razorpayCreate: (orderNumber: string) =>
    api<{ keyId: string; razorpayOrderId: string; amount: number; currency: string; orderNumber: string; name: string; prefill: { name: string; email: string; contact: string } }>(
      '/payments/razorpay/create',
      { method: 'POST', body: { orderNumber } },
    ),
  razorpayVerify: (body: { orderNumber: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    api<{ orderNumber: string }>('/payments/razorpay/verify', { method: 'POST', body }),
  razorpayFailed: (body: { orderNumber: string; razorpayOrderId: string; reason?: string }) => api<null>('/payments/razorpay/failed', { method: 'POST', body }),
  stripeCreate: (orderNumber: string) => api<{ clientSecret: string; publishableKey: string | null; amount: number }>('/payments/stripe/create', { method: 'POST', body: { orderNumber } }),
  stripeConfirm: (orderNumber: string) => api<{ status: 'PAID' | 'PROCESSING' | 'FAILED' | 'PENDING' }>('/payments/stripe/confirm', { method: 'POST', body: { orderNumber } }),
};

export const misc = {
  settings: () => api<PublicSettings>('/settings/public', { revalidate: 300 }),
  pincode: (pincode: string) => api<Serviceability>(`/shipping/pincode/${pincode}`),
  contact: (body: { name: string; email: string; phone?: string; subject: string; message: string }) => apiRequest<{ id: string }>('/contact', { method: 'POST', body }),
  notifications: () => api<Notification[]>('/notifications'),
  readNotifications: () => api<null>('/notifications/read', { method: 'POST' }),
  createReview: (body: { productId: string; orderItemId?: string; rating: number; title?: string; body: string; imageUrl?: string; imagePublicId?: string }) =>
    apiRequest<{ id: string; status: string }>('/reviews', { method: 'POST', body }),
  uploadReviewImage: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api<{ url: string; publicId: string }>('/uploads/review-image', { method: 'POST', body: fd });
  },
};
