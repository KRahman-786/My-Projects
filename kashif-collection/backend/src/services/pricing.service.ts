import type { PaymentMethod } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { discountPercent } from '../utils/money';
import { evaluateCoupon, type CouponResult } from './coupon.service';
import { getSettings } from './settings.service';
import { getShippingProvider } from './shipping/shipping.service';
import type { ServiceabilityResult } from './shipping/types';
import { lineTax, summarizeTax, type TaxBreakdownRow } from './tax.service';

export const MAX_QTY_PER_LINE = 10;

export interface QuoteItemInput {
  variantId: string;
  quantity: number;
}

export interface QuoteOptions {
  userId?: string;
  couponCode?: string | null;
  pincode?: string;
  state?: string;
  paymentMethod?: PaymentMethod;
  /**
   * strict = order placement: any unavailable item, stock shortfall, invalid coupon or unserviceable pincode
   * raises an error. Non-strict (cart display) reports issues instead.
   */
  strict?: boolean;
  db?: Tx | typeof prisma;
}

export type LineIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export interface QuoteLine {
  variantId: string;
  productId: string;
  categoryId: string;
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
  hsnCode: string | null;
  taxAmount: number;
  weightGrams: number;
  available: number;
  maxQuantity: number;
  issue: LineIssue | null;
}

export interface Quote {
  lines: QuoteLine[];
  /** Lines excluded from totals, with the reason */
  unavailable: QuoteLine[];
  summary: {
    itemCount: number;
    mrpTotal: number;
    subtotal: number;
    productDiscount: number;
    couponDiscount: number;
    taxTotal: number;
    taxInclusive: boolean;
    taxBreakdown: TaxBreakdownRow[];
    cgst: number;
    sgst: number;
    igst: number;
    shippingFee: number;
    codFee: number;
    grandTotal: number;
    freeShippingThreshold: number;
    amountToFreeShipping: number;
    totalSavings: number;
  };
  coupon: (CouponResult['coupon'] & { discount: number }) | null;
  couponError: { code: string; message: string } | null;
  shipping: ServiceabilityResult | null;
  cod: { available: boolean; reason: string | null; fee: number };
}

/**
 * The single source of truth for money. Cart, checkout preview and order creation all call this
 * with database prices — values sent by the client are never used.
 */
export async function buildQuote(items: QuoteItemInput[], opts: QuoteOptions = {}): Promise<Quote> {
  const db = opts.db ?? prisma;
  const settings = await getSettings();

  // Merge duplicate variants defensively.
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.quantity);

  const variants = merged.size
    ? await db.productVariant.findMany({
        where: { id: { in: [...merged.keys()] } },
        include: {
          inventory: { select: { availableStock: true } },
          product: {
            include: {
              category: { select: { slug: true, isActive: true, deletedAt: true } },
              images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
            },
          },
        },
      })
    : [];

  const lines: QuoteLine[] = [];
  const unavailable: QuoteLine[] = [];

  for (const [variantId, requestedQty] of merged) {
    const v = variants.find((x) => x.id === variantId);
    if (!v) {
      if (opts.strict) throw AppError.conflict('An item in your cart no longer exists', 'PRODUCT_UNAVAILABLE', { variantId });
      continue;
    }
    const p = v.product;
    const live = v.isActive && !v.deletedAt && p.isActive && !p.deletedAt && p.category.isActive && !p.category.deletedAt;
    const available = v.inventory?.availableStock ?? 0;
    const unitPrice = v.price ?? p.price;
    const mrp = v.mrp ?? p.mrp;
    const quantity = Math.min(requestedQty, MAX_QTY_PER_LINE);

    let issue: LineIssue | null = null;
    if (!live) issue = 'UNAVAILABLE';
    else if (available <= 0) issue = 'OUT_OF_STOCK';
    else if (available < quantity) issue = 'INSUFFICIENT_STOCK';

    const line: QuoteLine = {
      variantId,
      productId: p.id,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      categorySlug: p.category.slug,
      variantName: v.name,
      sku: v.sku,
      color: v.color,
      size: v.size,
      image: p.images[0]?.url ?? null,
      quantity,
      mrp,
      unitPrice,
      discountPercent: discountPercent(mrp, unitPrice),
      lineMrp: mrp * quantity,
      lineTotal: unitPrice * quantity,
      couponShare: 0,
      gstRate: Number(p.gstRate),
      hsnCode: p.hsnCode,
      taxAmount: 0,
      weightGrams: p.weightGrams * quantity,
      available,
      maxQuantity: Math.min(available, MAX_QTY_PER_LINE),
      issue,
    };

    if (issue) {
      if (opts.strict) {
        const label = `${p.name}${v.name !== 'Standard' ? ` (${v.name})` : ''}`;
        if (issue === 'UNAVAILABLE') throw AppError.conflict(`${label} is no longer available`, 'PRODUCT_UNAVAILABLE', { variantId });
        if (issue === 'OUT_OF_STOCK') throw AppError.conflict(`${label} is out of stock`, 'OUT_OF_STOCK', { variantId });
        throw AppError.conflict(`Only ${available} unit(s) of ${label} are available`, 'INSUFFICIENT_STOCK', { variantId, available });
      }
      unavailable.push(line);
    } else {
      lines.push(line);
    }
  }

  const mrpTotal = lines.reduce((s, l) => s + l.lineMrp, 0);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // Coupon
  let coupon: Quote['coupon'] = null;
  let couponError: Quote['couponError'] = null;
  if (opts.couponCode && lines.length) {
    try {
      const result = await evaluateCoupon(opts.couponCode, lines, opts.userId, db);
      result.allocations.forEach((share, i) => (lines[i]!.couponShare = share));
      coupon = { ...result.coupon, discount: result.discount };
    } catch (error) {
      if (opts.strict || !(error instanceof AppError)) throw error;
      couponError = { code: error.errorCode, message: error.message };
    }
  }
  const couponDiscount = coupon?.discount ?? 0;

  // Tax
  const inclusive = settings.pricesIncludeTax;
  for (const l of lines) l.taxAmount = lineTax(l.lineTotal - l.couponShare, l.gstRate, inclusive);
  const tax = summarizeTax(
    lines.map((l) => ({ amount: l.lineTotal - l.couponShare, rate: l.gstRate, tax: l.taxAmount })),
    inclusive,
    opts.state,
    settings.businessState,
  );

  // Shipping
  const provider = getShippingProvider();
  const netValue = subtotal - couponDiscount;
  let shipping: ServiceabilityResult | null = null;
  if (opts.pincode) {
    shipping = await provider.checkServiceability(opts.pincode);
    if (opts.strict && !shipping.serviceable) {
      throw AppError.unprocessable(`Sorry, we do not deliver to pincode ${opts.pincode} yet`, 'PINCODE_NOT_SERVICEABLE');
    }
  }
  const weightGrams = lines.reduce((s, l) => s + l.weightGrams, 0);
  const { fee: shippingFee } = lines.length ? await provider.getRate({ pincode: opts.pincode, orderValue: netValue, weightGrams }) : { fee: 0 };

  // COD
  const preCodTotal = netValue + shippingFee + (inclusive ? 0 : tax.taxTotal);
  let codReason: string | null = null;
  if (!settings.codEnabled) codReason = 'Cash on Delivery is currently unavailable';
  else if (preCodTotal < settings.codMinOrderValue) codReason = `COD is available on orders above ₹${settings.codMinOrderValue / 100}`;
  else if (preCodTotal > settings.codMaxOrderValue) codReason = `COD is available on orders up to ₹${settings.codMaxOrderValue / 100}`;
  else if (shipping && !shipping.codAvailable) codReason = 'COD is not available for this pincode';
  const codAvailable = codReason === null;
  if (opts.strict && opts.paymentMethod === 'COD' && !codAvailable) throw AppError.unprocessable(codReason!, 'COD_UNAVAILABLE');
  const codFee = opts.paymentMethod === 'COD' && codAvailable ? settings.codFee : 0;

  const grandTotal = preCodTotal + codFee;

  if (opts.strict && lines.length === 0) throw AppError.badRequest('Your cart is empty', 'CART_EMPTY');

  return {
    lines,
    unavailable,
    summary: {
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
      mrpTotal,
      subtotal,
      productDiscount: mrpTotal - subtotal,
      couponDiscount,
      taxTotal: tax.taxTotal,
      taxInclusive: inclusive,
      taxBreakdown: tax.breakdown,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      shippingFee,
      codFee,
      grandTotal,
      freeShippingThreshold: settings.freeShippingThreshold,
      amountToFreeShipping: Math.max(0, settings.freeShippingThreshold - netValue),
      totalSavings: mrpTotal - subtotal + couponDiscount,
    },
    coupon,
    couponError,
    shipping,
    cod: { available: codAvailable, reason: codReason, fee: settings.codFee },
  };
}
