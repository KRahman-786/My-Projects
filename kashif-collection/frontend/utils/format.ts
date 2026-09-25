const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formats integer paise as ₹ (drops paise when the amount is whole rupees). */
export function formatPrice(paise: number): string {
  return paise % 100 === 0 ? inr.format(paise / 100) : inrPaise.format(paise / 100);
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function titleCase(s: string) {
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function productUrl(p: { slug: string; category?: { slug: string } | null; categorySlug?: string }) {
  const cat = p.category?.slug ?? p.categorySlug ?? 'shop';
  return `/products/${cat}/${p.slug}`;
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
};
