'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, Printer } from 'lucide-react';
import { admin } from '@/services/admin';
import { ordersApi } from '@/services/account';
import { PageHeader, Panel } from '@/components/admin/ui';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { SmartImage } from '@/components/ui/SmartImage';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { formatDateTime, formatPrice, ORDER_STATUS_LABEL } from '@/utils/format';
import type { OrderStatus } from '@/types';

export default function AdminOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-order', orderNumber], queryFn: () => admin.order(orderNumber) });
  const [next, setNext] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState message="Order not found." />;
  const o = q.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-order', orderNumber] });
    void qc.invalidateQueries({ queryKey: ['admin-orders'] });
  };
  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast(msg);
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const invoiceUrl = ordersApi.invoiceUrl(o.orderNumber);
  const openReturn = o.returns.find((r) => ['REQUESTED', 'APPROVED'].includes(r.status));

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" className="text-sm text-ink-muted hover:text-plum-700">
        ← Orders
      </Link>
      <PageHeader
        title={o.orderNumber}
        description={`Placed ${formatDateTime(o.placedAt)}`}
        actions={
          !['PENDING', 'CANCELLED'].includes(o.status) && (
            <>
              <a href={`${invoiceUrl}?download=0`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium hover:bg-sand">
                <Printer className="h-4 w-4" /> Print invoice
              </a>
              <a href={invoiceUrl} className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium hover:bg-sand">
                <Download className="h-4 w-4" /> Download
              </a>
            </>
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone={statusTone(o.status)} className="text-xs">
          {ORDER_STATUS_LABEL[o.status]}
        </Badge>
        <Badge tone={statusTone(o.paymentStatus)} className="text-xs">
          {o.paymentMethod} · {o.paymentStatus}
        </Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Panel title={`Items (${o.items.length})`}>
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-sand">{i.imageUrl && <SmartImage src={i.imageUrl} alt="" fill sizes="48px" className="object-cover" />}</span>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{i.productName}</p>
                    <p className="text-xs text-ink-muted">
                      {i.variantName} · {i.sku} · GST {i.gstRate}%
                    </p>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {formatPrice(i.unitPrice)} × {i.quantity}
                  </p>
                  <p className="w-24 text-right text-sm font-semibold">{formatPrice(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
              {[
                ['Total MRP', formatPrice(o.mrpTotal)],
                ['Product discount', `− ${formatPrice(o.productDiscount)}`],
                ...(o.couponDiscount ? [[`Coupon (${o.couponCode})`, `− ${formatPrice(o.couponDiscount)}`]] : []),
                ['Shipping', o.shippingFee ? formatPrice(o.shippingFee) : 'FREE'],
                ...(o.codFee ? [['COD fee', formatPrice(o.codFee)]] : []),
                [`GST${o.taxInclusive ? ' (included)' : ''}`, o.igst ? `IGST ${formatPrice(o.igst)}` : `CGST ${formatPrice(o.cgst)} · SGST ${formatPrice(o.sgst)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Grand total</dt>
                <dd>{formatPrice(o.grandTotal)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Payments">
            <ul className="divide-y divide-line text-sm">
              {o.payments.length === 0 && <li className="px-5 py-4 text-ink-muted">No payment attempts yet.</li>}
              {o.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <span>
                    <b>{p.gateway}</b> · {formatPrice(p.amount)} {p.gatewayPaymentId && <span className="font-mono text-xs text-ink-muted">· {p.gatewayPaymentId}</span>}
                    {p.failureReason && <span className="block text-xs text-danger">{p.failureReason}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-ink-muted">{formatDateTime(p.paidAt ?? p.createdAt)}</span>
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          {(o.returns.length > 0 || o.refunds.length > 0) && (
            <Panel title="Returns & refunds">
              <ul className="divide-y divide-line text-sm">
                {o.returns.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span>
                        Return: <b>{r.reason}</b>
                      </span>
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </div>
                    {r.details && <p className="mt-1 text-xs text-ink-muted">{r.details}</p>}
                    {openReturn?.id === r.id && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.status === 'REQUESTED' && (
                          <Button size="sm" variant="secondary" loading={busy === 'approve'} onClick={() => void run('approve', () => admin.resolveReturn(r.id, 'APPROVE'), 'Return approved')}>
                            Approve
                          </Button>
                        )}
                        <Button size="sm" loading={busy === 'receive'} onClick={() => void run('receive', () => admin.resolveReturn(r.id, 'RECEIVE'), 'Items received, stock restored and refund created')}>
                          Mark received
                        </Button>
                        <Button size="sm" variant="ghost" loading={busy === 'reject'} onClick={() => void run('reject', () => admin.resolveReturn(r.id, 'REJECT'), 'Return rejected')}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
                {o.refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <span>
                      Refund <b>{formatPrice(r.amount)}</b> <span className="text-xs text-ink-muted">{r.reason}</span>
                      {r.gatewayRefundId && <span className="block font-mono text-xs text-ink-muted">{r.gatewayRefundId}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                      {r.status !== 'PROCESSED' && (
                        <Button
                          size="sm"
                          loading={busy === r.id}
                          onClick={() => {
                            const manual = o.paymentMethod === 'COD' ? (prompt('Bank/UPI transaction reference for this manual refund:') ?? '') : undefined;
                            if (o.paymentMethod === 'COD' && !manual) return;
                            void run(r.id, () => admin.processRefund(r.id, manual), 'Refund processed');
                          }}
                        >
                          Process refund
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="History">
            <ol className="space-y-3 px-5 py-4">
              {o.statusHistory.map((h, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-plum-600" />
                  <div>
                    <p>
                      <b>{ORDER_STATUS_LABEL[h.toStatus]}</b> {h.changedBy && <span className="text-ink-muted">by {h.changedBy.name}</span>}
                    </p>
                    {h.note && <p className="text-ink-soft">{h.note}</p>}
                    <p className="text-xs text-ink-muted">{formatDateTime(h.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Update status">
            <div className="space-y-3 p-5">
              {o.allowedTransitions.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {o.status === 'PENDING' ? 'Awaiting online payment — the order moves to Paid automatically once the gateway confirms.' : 'No further manual status changes for this order.'}
                </p>
              ) : (
                <>
                  <Select label="New status" value={next} onChange={(e) => setNext(e.target.value as OrderStatus)}>
                    <option value="">Choose…</option>
                    {o.allowedTransitions.map((s) => (
                      <option key={s} value={s}>
                        {ORDER_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  {next === 'SHIPPED' && <Input label="Tracking number (AWB)" value={tracking} onChange={(e) => setTracking(e.target.value)} />}
                  <Textarea label={next === 'CANCELLED' ? 'Cancellation reason' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[70px]" />
                  {next === 'CANCELLED' && <p className="text-xs text-danger">Cancelling releases stock and, for paid orders, creates a refund.</p>}
                  <Button
                    block
                    disabled={!next}
                    loading={busy === 'status'}
                    variant={next === 'CANCELLED' ? 'danger' : 'primary'}
                    onClick={() =>
                      next &&
                      void run('status', () => admin.updateStatus(o.orderNumber, { status: next, note: note || undefined, trackingNumber: tracking || undefined }), `Order marked ${ORDER_STATUS_LABEL[next]}`).then(() => {
                        setNext('');
                        setNote('');
                      })
                    }
                  >
                    Update
                  </Button>
                </>
              )}
              {o.trackingNumber && (
                <p className="rounded-xl bg-ivory p-3 text-xs">
                  AWB <b className="font-mono">{o.trackingNumber}</b>
                  {o.trackingUrl && (
                    <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-plum-700">
                      Track <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Customer">
            <div className="space-y-1 p-5 text-sm">
              <p className="font-semibold">{o.user.name}</p>
              <p className="text-ink-soft">{o.user.email}</p>
              {o.user.phone && <p className="text-ink-soft">{o.user.phone}</p>}
              <Link href={`/admin/customers/${o.user.id}`} className="inline-block pt-2 text-xs font-semibold text-plum-700">
                View customer →
              </Link>
            </div>
          </Panel>

          <Panel title="Shipping address">
            <div className="p-5 text-sm leading-relaxed text-ink-soft">
              <p className="font-semibold text-ink">{o.shipName}</p>
              <p>
                {o.shipHouse}, {o.shipStreet}
                {o.shipArea ? `, ${o.shipArea}` : ''}
              </p>
              {o.shipLandmark && <p>{o.shipLandmark}</p>}
              <p>
                {o.shipCity}, {o.shipState} – {o.shipPincode}
              </p>
              <p>📞 {o.shipPhone}</p>
              {o.customerNote && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Note: {o.customerNote}</p>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
