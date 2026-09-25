import type { ReactNode } from 'react';
import type { QuoteSummary } from '@/types';
import { formatPrice } from '@/utils/format';

function Row({ label, value, tone, sub }: { label: ReactNode; value: ReactNode; tone?: 'green' | 'muted'; sub?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${sub ? 'pl-3 text-xs text-ink-muted' : 'text-sm'}`}>
      <dt className={sub ? '' : 'text-ink-soft'}>{label}</dt>
      <dd className={tone === 'green' ? 'font-medium text-success' : tone === 'muted' ? 'text-ink-muted' : 'font-medium text-ink'}>{value}</dd>
    </div>
  );
}

/** Price breakdown exactly as computed by the backend pricing service. */
export function OrderSummary({ summary, couponCode, footer, title = 'Price details' }: { summary: QuoteSummary; couponCode?: string | null; footer?: ReactNode; title?: string }) {
  const gstRows = summary.igst > 0 ? [['IGST', summary.igst]] : [['CGST', summary.cgst], ['SGST', summary.sgst]];
  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
        {title} ({summary.itemCount} item{summary.itemCount === 1 ? '' : 's'})
      </h2>
      <dl className="mt-4 space-y-2.5">
        <Row label="Total MRP" value={formatPrice(summary.mrpTotal)} />
        {summary.productDiscount > 0 && <Row label="Discount on MRP" value={`− ${formatPrice(summary.productDiscount)}`} tone="green" />}
        {summary.couponDiscount > 0 && <Row label={`Coupon${couponCode ? ` (${couponCode})` : ''}`} value={`− ${formatPrice(summary.couponDiscount)}`} tone="green" />}
        <Row label="Shipping" value={summary.shippingFee === 0 ? <span className="text-success">FREE</span> : formatPrice(summary.shippingFee)} />
        {summary.codFee > 0 && <Row label="COD handling fee" value={formatPrice(summary.codFee)} />}
        <Row label={summary.taxInclusive ? 'GST (included in price)' : 'GST'} value={formatPrice(summary.taxTotal)} tone={summary.taxInclusive ? 'muted' : undefined} />
        {summary.taxTotal > 0 && gstRows.map(([l, v]) => <Row key={l as string} sub label={l} value={formatPrice(v as number)} />)}
        {summary.taxBreakdown.length > 1 &&
          summary.taxBreakdown.map((t) => <Row key={t.rate} sub label={`@ ${t.rate}% on ${formatPrice(t.taxableValue)}`} value={formatPrice(t.tax)} />)}
      </dl>
      <div className="mt-4 flex items-center justify-between border-t border-dashed border-line pt-4">
        <span className="font-semibold">Total amount</span>
        <span className="text-xl font-bold text-ink">{formatPrice(summary.grandTotal)}</span>
      </div>
      {summary.totalSavings > 0 && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-center text-sm font-medium text-success">You save {formatPrice(summary.totalSavings)} on this order 🎉</p>
      )}
      {footer && <div className="mt-5">{footer}</div>}
    </div>
  );
}
