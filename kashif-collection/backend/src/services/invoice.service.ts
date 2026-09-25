import PDFDocument from 'pdfkit';
import type { Writable } from 'node:stream';
import { prisma } from '../config/prisma';
import { BUSINESS } from '../config/business';
import { AppError } from '../utils/AppError';

// PDFKit's standard fonts cannot render "₹", so amounts are printed as "Rs." on invoices.
const rs = (paise: number) => `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

const INVOICEABLE = ['CONFIRMED', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'];

export async function getInvoiceOrder(orderNumber: string, requester: { id: string; isAdmin: boolean }) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { items: true, user: { select: { name: true, email: true, phone: true } } } });
  if (!order || (!requester.isAdmin && order.userId !== requester.id)) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  if (!INVOICEABLE.includes(order.status)) throw AppError.unprocessable('An invoice is available once the order is confirmed', 'INVOICE_NOT_AVAILABLE');
  return order;
}

type InvoiceOrder = Awaited<ReturnType<typeof getInvoiceOrder>>;

const PLUM = '#5B1A32';
const GOLD = '#B8875A';
const INK = '#2B2126';
const MUTED = '#7A6A70';
const LINE = '#E8DCD5';

/** Streams a professionally laid out A4 tax invoice to `out`. */
export function renderInvoice(order: InvoiceOrder, out: Writable) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Invoice ${order.orderNumber}`, Author: BUSINESS.name } });
  doc.pipe(out);
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;

  // Header band
  doc.rect(0, 0, doc.page.width, 96).fill(PLUM);
  doc.fillColor('#FFFFFF').font('Times-Bold').fontSize(24).text(BUSINESS.name.toUpperCase(), left, 30, { characterSpacing: 2 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#EAD7C3').text('COSMETICS  ·  LACE  ·  ARTIFICIAL JEWELLERY', left, 60, { characterSpacing: 1.5 });
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#FFFFFF').text('TAX INVOICE', left, 32, { width, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor('#EAD7C3').text(`Invoice No: INV-${order.orderNumber}`, left, 55, { width, align: 'right' });

  // Seller / buyer / meta
  let y = 116;
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(8).text('SOLD BY', left, y);
  doc.text('BILL / SHIP TO', left + 190, y);
  doc.text('ORDER DETAILS', left + 380, y);
  y += 13;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(BUSINESS.name, left, y, { width: 175 });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  doc.text([...BUSINESS.addressLines, BUSINESS.phone, BUSINESS.email, `GSTIN: ${BUSINESS.gstin}`].join('\n'), left, y + 14, { width: 175, lineGap: 1.5 });

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(order.shipName, left + 190, y, { width: 175 });
  const addr = [
    `${order.shipHouse}, ${order.shipStreet}`,
    [order.shipArea, order.shipLandmark].filter(Boolean).join(', '),
    `${order.shipCity}, ${order.shipState} ${order.shipPincode}`,
    order.shipCountry,
    `Phone: ${order.shipPhone}`,
    order.user.email,
  ].filter(Boolean);
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(addr.join('\n'), left + 190, y + 14, { width: 175, lineGap: 1.5 });

  const meta: [string, string][] = [
    ['Order No.', order.orderNumber],
    ['Order Date', fmtDate(order.placedAt)],
    ['Payment', order.paymentMethod === 'COD' ? 'COD' : order.paymentMethod === 'RAZORPAY' ? 'Razorpay' : 'Card (Stripe)'],
    ['Payment Status', order.paymentStatus],
    ['Place of Supply', order.shipState],
  ];
  meta.forEach(([k, v], i) => {
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k, left + 380, y + i * 14, { width: 66, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor(INK).text(v, left + 446, y + i * 14, { width: width - 446, align: 'right', lineBreak: false });
  });

  // Items table
  y = 250;
  const cols = [
    { label: '#', w: 18, align: 'left' as const },
    { label: 'Item', w: 170, align: 'left' as const },
    { label: 'SKU', w: 72, align: 'left' as const },
    { label: 'Qty', w: 28, align: 'right' as const },
    { label: 'MRP', w: 62, align: 'right' as const },
    { label: 'Discount', w: 55, align: 'right' as const },
    { label: 'GST', w: 50, align: 'right' as const },
    { label: 'Amount', w: width - 455, align: 'right' as const },
  ];
  doc.rect(left, y, width, 20).fill('#F6EEE8');
  let x = left;
  doc.fillColor(PLUM).font('Helvetica-Bold').fontSize(8);
  for (const c of cols) {
    doc.text(c.label.toUpperCase(), x + 4, y + 6, { width: c.w - 8, align: c.align });
    x += c.w;
  }
  y += 24;

  order.items.forEach((item, idx) => {
    const discount = (item.mrp - item.unitPrice) * item.quantity + item.couponShare;
    const amount = item.lineTotal - item.couponShare;
    const cells = [
      String(idx + 1),
      `${item.productName}${item.variantName !== 'Standard' ? `\n${item.variantName}` : ''}${item.hsnCode ? `\nHSN ${item.hsnCode}` : ''}`,
      item.sku,
      String(item.quantity),
      rs(item.mrp),
      discount > 0 ? `-${rs(discount)}` : '—',
      `${Number(item.gstRate)}%\n${rs(item.taxAmount)}`,
      rs(amount),
    ];
    const rowHeight = Math.max(26, doc.font('Helvetica').fontSize(8.5).heightOfString(cells[1]!, { width: cols[1]!.w - 8 }) + 10);
    if (y + rowHeight > doc.page.height - 200) {
      doc.addPage();
      y = 50;
    }
    x = left;
    cells.forEach((cell, ci) => {
      doc.font(ci === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(ci === 1 ? INK : MUTED);
      doc.text(cell, x + 4, y + 4, { width: cols[ci]!.w - 8, align: cols[ci]!.align, lineGap: 1 });
      x += cols[ci]!.w;
    });
    y += rowHeight;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).lineWidth(0.7).stroke();
  });

  // Totals
  y += 14;
  const totals: [string, string, boolean?][] = [
    ['Total MRP', rs(order.mrpTotal)],
    ['Product Discount', `-${rs(order.productDiscount)}`],
    ...(order.couponDiscount > 0 ? ([[`Coupon (${order.couponCode})`, `-${rs(order.couponDiscount)}`]] as [string, string][]) : []),
    ['Shipping', order.shippingFee === 0 ? 'FREE' : rs(order.shippingFee)],
    ...(order.codFee > 0 ? ([['COD Fee', rs(order.codFee)]] as [string, string][]) : []),
    ...(order.igst > 0
      ? ([[`IGST${order.taxInclusive ? ' (included)' : ''}`, rs(order.igst)]] as [string, string][])
      : ([
          [`CGST${order.taxInclusive ? ' (included)' : ''}`, rs(order.cgst)],
          [`SGST${order.taxInclusive ? ' (included)' : ''}`, rs(order.sgst)],
        ] as [string, string][])),
  ];
  const tx = left + width - 230;
  for (const [k, v] of totals) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(k, tx, y, { width: 130 });
    doc.fillColor(INK).text(v, tx + 130, y, { width: 100, align: 'right' });
    y += 15;
  }
  y += 4;
  doc.rect(tx - 8, y - 4, 246, 26).fill(PLUM);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('GRAND TOTAL', tx, y + 4, { width: 130 });
  doc.text(rs(order.grandTotal), tx + 130, y + 4, { width: 100, align: 'right' });

  // Notes
  doc.font('Helvetica-Bold').fontSize(8).fillColor(GOLD).text('NOTES', left, y - 60);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `${order.taxInclusive ? 'All prices are inclusive of GST. ' : ''}Goods once sold can be returned within the return window as per our Return & Refund Policy. This is a computer-generated invoice and does not require a signature.`,
    left,
    y - 47,
    { width: 250, lineGap: 1.5 },
  );

  // Footer (drawn inside the bottom margin, so disable the margin to avoid PDFKit adding a page)
  doc.page.margins.bottom = 0;
  const fy = doc.page.height - 60;
  doc.moveTo(left, fy).lineTo(right, fy).strokeColor(GOLD).lineWidth(1).stroke();
  doc.font('Times-Italic').fontSize(11).fillColor(PLUM).text('Thank you for shopping with Kashif Collection', left, fy + 10, { width, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(`${BUSINESS.addressLines.join(', ')}  ·  ${BUSINESS.email}`, left, fy + 28, { width, align: 'center', lineBreak: false });

  doc.end();
}
