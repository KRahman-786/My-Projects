import { api, apiRequest } from '@/lib/api';
import type { Category, Notification, OrderStatus } from '@/types';

type Q = Record<string, string | number | boolean | undefined>;

export interface DashboardData {
  stats: {
    todaySales: number;
    todayOrders: number;
    totalRevenue: number;
    totalOrders: number;
    totalCustomers: number;
    totalProducts: number;
    pendingOrders: number;
    lowStockProducts: number;
    refundRequests: number;
  };
  charts: {
    dailySales: { date: string; revenue: number; orders: number }[];
    monthlySales: { month: string; revenue: number; orders: number }[];
    categorySales: { category: string; revenue: number; units: number }[];
    bestSellers: { name: string; slug: string; units: number; revenue: number }[];
    paymentMethods: { method: string; orders: number; revenue: number }[];
    ordersByStatus: { status: string; count: number }[];
  };
  recentOrders: { orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; grandTotal: number; createdAt: string; shipName: string }[];
}

export interface AdminProductRow {
  id: string;
  name: string;
  sku: string;
  slug: string;
  price: number;
  mrp: number;
  isActive: boolean;
  isFeatured: boolean;
  category: { name: string };
  images: { url: string }[];
  variantCount: number;
  stock: { total: number; reserved: number; available: number; low: boolean };
  updatedAt: string;
}

export interface AdminVariant {
  id?: string;
  sku: string;
  name: string;
  color?: string | null;
  colorHex?: string | null;
  size?: string | null;
  price?: number | null;
  mrp?: number | null;
  isActive?: boolean;
  initialStock?: number;
  lowStockThreshold?: number;
  inventory?: { totalStock: number; reservedStock: number; availableStock: number; lowStockThreshold: number } | null;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription: string | null;
  categoryId: string;
  subcategoryId: string | null;
  brand: string;
  mrp: number;
  price: number;
  gstRate: number;
  hsnCode: string | null;
  weightGrams: number;
  tags: string[];
  ingredients: string | null;
  howToUse: string | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isActive: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  images: { url: string; publicId: string | null; altText: string | null }[];
  specifications: { label: string; value: string }[];
  variants: AdminVariant[];
  category: { id: string; name: string };
}

export interface InventoryRow {
  id: string;
  variantId: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  variant: { id: string; sku: string; name: string; product: { id: string; name: string; slug: string; sku: string } };
}

export interface AdminOrderRow {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  grandTotal: number;
  createdAt: string;
  shipName: string;
  shipCity: string;
  user: { name: string; email: string };
  _count: { items: number };
}

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minCartValue: number;
  maxDiscount: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  isActive: boolean;
  categories: { category: { id: string; name: string } }[];
  products: { product: { id: string; name: string } }[];
}

export interface StoreSettings {
  codEnabled: boolean;
  codMinOrderValue: number;
  codMaxOrderValue: number;
  codFee: number;
  flatShippingFee: number;
  freeShippingThreshold: number;
  pricesIncludeTax: boolean;
  defaultGstRate: number;
  businessState: string;
  orderReservationMinutes: number;
  returnWindowDays: number;
  defaultLowStockThreshold: number;
}

export const admin = {
  dashboard: () => api<DashboardData>('/admin/dashboard'),
  // products
  products: (q: Q) => apiRequest<AdminProductRow[]>('/admin/products', { query: q }),
  product: (id: string) => api<AdminProduct>(`/admin/products/${id}`),
  createProduct: (body: unknown) => api<AdminProduct>('/admin/products', { method: 'POST', body }),
  updateProduct: (id: string, body: unknown) => api<AdminProduct>(`/admin/products/${id}`, { method: 'PATCH', body }),
  setProductActive: (id: string, isActive: boolean) => api(`/admin/products/${id}/status`, { method: 'PATCH', body: { isActive } }),
  deleteProduct: (id: string) => api(`/admin/products/${id}`, { method: 'DELETE' }),
  upload: (files: File[], folder = 'products') => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return api<{ url: string; publicId: string }[]>(`/admin/uploads?folder=${folder}`, { method: 'POST', body: fd });
  },
  // categories
  categories: () => api<Category[]>('/admin/categories'),
  createCategory: (body: unknown) => api('/admin/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: unknown) => api(`/admin/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id: string) => api(`/admin/categories/${id}`, { method: 'DELETE' }),
  createSubcategory: (body: unknown) => api('/admin/subcategories', { method: 'POST', body }),
  updateSubcategory: (id: string, body: unknown) => api(`/admin/subcategories/${id}`, { method: 'PATCH', body }),
  deleteSubcategory: (id: string) => api(`/admin/subcategories/${id}`, { method: 'DELETE' }),
  // orders
  orders: (q: Q) => apiRequest<AdminOrderRow[]>('/admin/orders', { query: q }),
  order: (orderNumber: string) => api<import('@/types').Order & { user: { id: string; name: string; email: string; phone: string | null; createdAt: string }; allowedTransitions: OrderStatus[]; customerNote: string | null }>(`/admin/orders/${orderNumber}`),
  updateStatus: (orderNumber: string, body: { status: OrderStatus; note?: string; trackingNumber?: string; trackingUrl?: string }) =>
    api(`/admin/orders/${orderNumber}/status`, { method: 'PATCH', body }),
  returns: (q: Q) => apiRequest<{ id: string; reason: string; details: string | null; status: string; createdAt: string; order: { orderNumber: string; grandTotal: number; paymentMethod: string }; user: { name: string; email: string } }[]>('/admin/returns', { query: q }),
  resolveReturn: (id: string, action: 'APPROVE' | 'REJECT' | 'RECEIVE', note?: string) => api(`/admin/returns/${id}`, { method: 'PATCH', body: { action, note } }),
  refunds: (q: Q) =>
    apiRequest<{ id: string; amount: number; status: string; reason: string | null; createdAt: string; processedAt: string | null; gatewayRefundId: string | null; order: { orderNumber: string; paymentMethod: string; user: { name: string; email: string } }; payment: { gateway: string } | null }[]>(
      '/admin/refunds',
      { query: q },
    ),
  processRefund: (id: string, manualReference?: string) => api(`/admin/refunds/${id}/process`, { method: 'POST', body: { manualReference } }),
  // customers
  customers: (q: Q) => apiRequest<{ id: string; name: string; email: string; phone: string | null; isActive: boolean; createdAt: string; lastLoginAt: string | null; orderCount: number; totalSpent: number }[]>('/admin/customers', { query: q }),
  customer: (id: string) =>
    api<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      isActive: boolean;
      createdAt: string;
      lastLoginAt: string | null;
      totalSpent: number;
      addresses: import('@/types').Address[];
      orders: { orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; grandTotal: number; createdAt: string }[];
      _count: { reviews: number; orders: number };
    }>(`/admin/customers/${id}`),
  setCustomerActive: (id: string, isActive: boolean) => api(`/admin/customers/${id}/status`, { method: 'PATCH', body: { isActive } }),
  // inventory
  inventory: (q: Q) => apiRequest<InventoryRow[]>('/admin/inventory', { query: q }),
  adjust: (body: { variantId: string; delta: number; type: 'RESTOCK' | 'ADJUSTMENT'; reason: string; lowStockThreshold?: number }) => api('/admin/inventory/adjust', { method: 'POST', body }),
  history: (variantId: string) =>
    apiRequest<{ items: { id: string; type: string; quantity: number; totalAfter: number; reservedAfter: number; reason: string | null; createdAt: string; performedBy: { name: string } | null; order: { orderNumber: string } | null }[] }>(
      `/admin/inventory/${variantId}/history`,
      { query: { limit: 50 } },
    ),
  // coupons
  coupons: () => apiRequest<CouponRow[]>('/admin/coupons', { query: { limit: 100 } }),
  createCoupon: (body: unknown) => api('/admin/coupons', { method: 'POST', body }),
  updateCoupon: (id: string, body: unknown) => api(`/admin/coupons/${id}`, { method: 'PATCH', body }),
  deleteCoupon: (id: string) => api(`/admin/coupons/${id}`, { method: 'DELETE' }),
  // reviews
  reviews: (q: Q) =>
    apiRequest<{ id: string; rating: number; title: string | null; body: string; imageUrl: string | null; status: string; isVerifiedPurchase: boolean; createdAt: string; user: { name: string; email: string }; product: { name: string; slug: string } }[]>(
      '/admin/reviews',
      { query: q },
    ),
  setReviewStatus: (id: string, status: string) => api(`/admin/reviews/${id}`, { method: 'PATCH', body: { status } }),
  deleteReview: (id: string) => api(`/admin/reviews/${id}`, { method: 'DELETE' }),
  // settings
  settings: () => api<StoreSettings>('/admin/settings'),
  updateSettings: (body: Partial<StoreSettings>) => api<StoreSettings>('/admin/settings', { method: 'PATCH', body }),
  pincodes: () => api<{ pincode: string; city: string | null; state: string | null; isServiceable: boolean; codAvailable: boolean; deliveryDays: number }[]>('/admin/pincodes'),
  upsertPincode: (body: unknown) => api('/admin/pincodes', { method: 'PUT', body }),
  deletePincode: (pincode: string) => api(`/admin/pincodes/${pincode}`, { method: 'DELETE' }),
  // messages & notifications
  messages: (q: Q) => apiRequest<{ id: string; name: string; email: string; phone: string | null; subject: string; message: string; isHandled: boolean; createdAt: string }[]>('/admin/messages', { query: q }),
  markMessage: (id: string, isHandled: boolean) => api(`/admin/messages/${id}`, { method: 'PATCH', body: { isHandled } }),
  notifications: () => api<Notification[]>('/admin/notifications'),
  readNotifications: () => api('/admin/notifications/read', { method: 'POST' }),
};

/** Admin forms edit rupees; the API stores paise. */
export const toPaise = (rupees: string | number) => Math.round(Number(rupees) * 100);
export const toRupees = (paise: number | null | undefined) => (paise == null ? '' : String(paise / 100));
