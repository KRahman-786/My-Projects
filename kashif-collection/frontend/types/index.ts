/** All monetary values from the API are integer paise. */

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type Role = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: string;
}

export interface Subcategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  productCount?: number;
  categoryId?: string;
  sortOrder?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive?: boolean;
  sortOrder?: number;
  productCount?: number;
  subcategories: Subcategory[];
}

export interface ProductImage {
  id?: string;
  url: string;
  altText: string | null;
}

export interface ProductCard {
  id: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  brand: string;
  category: { name: string; slug: string };
  subcategory: { name: string; slug: string } | null;
  mrp: number;
  price: number;
  discountPercent: number;
  ratingAvg: number;
  ratingCount: number;
  images: ProductImage[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  inStock: boolean;
  colors: { name: string; hex: string | null }[];
  variantCount: number;
  defaultVariantId: string | null;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  price: number;
  mrp: number;
  discountPercent: number;
  inStock: boolean;
  lowStock: number | null;
}

export interface ProductDetail {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  brand: string;
  mrp: number;
  price: number;
  discountPercent: number;
  gstRate: number;
  weightGrams: number;
  tags: string[];
  ingredients: string | null;
  howToUse: string | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  ratingAvg: number;
  ratingCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
  category: { id: string; name: string; slug: string };
  subcategory: { id: string; name: string; slug: string } | null;
  images: ProductImage[];
  specifications: { label: string; value: string }[];
  variants: ProductVariant[];
  inStock: boolean;
  ratingBreakdown: { rating: number; count: number }[];
  updatedAt: string;
}

export interface Facets {
  brands: { name: string; count: number }[];
  colors: { name: string; hex: string | null }[];
  sizes: string[];
  priceRange: { min: number; max: number };
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  imageUrl: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
  author: string;
  product?: { name: string; slug: string; category: { slug: string } };
}

export interface Offer {
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minCartValue: number;
  maxDiscount: number | null;
  expiresAt: string | null;
}

export interface HomeData {
  featured: ProductCard[];
  newArrivals: ProductCard[];
  bestSellers: ProductCard[];
  cosmetics: ProductCard[];
  lace: ProductCard[];
  jewellery: ProductCard[];
  offers: ProductCard[];
  coupons: Offer[];
  categories: Category[];
  reviews: Review[];
}

export type LineIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export interface QuoteLine {
  itemId?: string;
  variantId: string;
  productId: string;
  name: string;
  slug: string;
  categorySlug: string;
  variantName: string;
  sku: string;
  color: string | null;
  size: string | null;
  image: string | null;
  quantity: number;
  mrp: number;
  unitPrice: number;
  discountPercent: number;
  lineMrp: number;
  lineTotal: number;
  couponShare: number;
  gstRate: number;
  taxAmount: number;
  available: number;
  maxQuantity: number;
  issue: LineIssue | null;
}

export interface QuoteSummary {
  itemCount: number;
  mrpTotal: number;
  subtotal: number;
  productDiscount: number;
  couponDiscount: number;
  taxTotal: number;
  taxInclusive: boolean;
  taxBreakdown: { rate: number; taxableValue: number; tax: number }[];
  cgst: number;
  sgst: number;
  igst: number;
  shippingFee: number;
  codFee: number;
  grandTotal: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  totalSavings: number;
}

export interface Serviceability {
  pincode: string;
  serviceable: boolean;
  codAvailable: boolean;
  deliveryDays: number;
  estimatedDeliveryDate: string;
}

export interface Quote {
  lines: QuoteLine[];
  unavailable: QuoteLine[];
  summary: QuoteSummary;
  coupon: { code: string; description: string | null; discount: number } | null;
  couponError: { code: string; message: string } | null;
  shipping: Serviceability | null;
  cod: { available: boolean; reason: string | null; fee: number };
  couponCode?: string | null;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  house: string;
  street: string;
  area: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PAID' | 'PROCESSING' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'CANCELLED' | 'RETURN_REQUESTED' | 'RETURNED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'RAZORPAY' | 'STRIPE' | 'COD';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  mrp: number;
  unitPrice: number;
  lineTotal: number;
  couponShare: number;
  gstRate: number;
  taxAmount: number;
  review: { id: string; rating: number; status: string } | null;
}

export interface OrderSummaryRow {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  grandTotal: number;
  placedAt: string;
  estimatedDeliveryDate: string | null;
  items: { productName: string; imageUrl: string | null; quantity: number; variantName: string }[];
}

export interface Order {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  mrpTotal: number;
  subtotal: number;
  productDiscount: number;
  couponDiscount: number;
  couponCode: string | null;
  taxTotal: number;
  taxInclusive: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  shippingFee: number;
  codFee: number;
  grandTotal: number;
  shipName: string;
  shipPhone: string;
  shipHouse: string;
  shipStreet: string;
  shipArea: string | null;
  shipLandmark: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  shipCountry: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDeliveryDate: string | null;
  reservationExpiresAt: string | null;
  cancelReason: string | null;
  customerNote: string | null;
  placedAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  statusHistory: { fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; createdAt: string; changedBy?: { name: string } | null }[];
  payments: { id: string; gateway: PaymentMethod; amount: number; status: PaymentStatus; gatewayPaymentId: string | null; failureReason: string | null; paidAt: string | null; createdAt: string }[];
  returns: { id: string; reason: string; details: string | null; status: string; adminNote: string | null; createdAt: string }[];
  refunds: { id: string; amount: number; status: string; reason: string | null; processedAt: string | null; createdAt: string; gatewayRefundId: string | null }[];
  canCancel: boolean;
  canReturn: boolean;
  canPay: boolean;
  canReview: boolean;
  returnDeadline: string | null;
}

export interface PublicSettings {
  codEnabled: boolean;
  codMinOrderValue: number;
  codMaxOrderValue: number;
  codFee: number;
  flatShippingFee: number;
  freeShippingThreshold: number;
  pricesIncludeTax: boolean;
  returnWindowDays: number;
}

export interface PaymentConfig {
  razorpay: { enabled: boolean; keyId: string | null };
  stripe: { enabled: boolean; publishableKey: string | null };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}
