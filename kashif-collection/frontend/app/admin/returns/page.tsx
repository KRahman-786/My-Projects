'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '@/services/admin';
import { FilterSelect, LoadingRows, PageHeader, Pager, Panel, Table } from '@/components/admin/ui';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { formatDateTime, formatPrice } from '@/utils/format';

export default function ReturnsRefundsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [rStatus, setRStatus] = useState('REQUESTED');
  const [fStatus, setFStatus] = useState('PENDING');
  const [rPage, setRPage] = useState(1);
  const [fPage, setFPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const returns = useQuery({ queryKey: ['admin-returns', rStatus, rPage], queryFn: () => admin.returns({ status: rStatus || undefined, page: rPage }), placeholderData: (p) => p });
  const refunds = useQuery({ queryKey: ['admin-refunds', fStatus, fPage], queryFn: () => admin.refunds({ status: fStatus || undefined, page: fPage }), placeholderData: (p) => p });

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast(msg);
      void qc.invalidateQueries({ queryKey: ['admin-returns'] });
      void qc.invalidateQueries({ queryKey: ['admin-refunds'] });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Returns & refunds" description="Receiving a return restocks items and creates a refund. Online refunds go back through Razorpay/Stripe; COD refunds are paid manually and recorded here." />
      <Panel title="Return requests" actions={<FilterSelect label="Return status" value={rStatus} onChange={(v) => { setRStatus(v); setRPage(1); }} options={[['REQUESTED', 'Requested'], ['APPROVED', 'Approved'], ['RECEIVED', 'Received'], ['COMPLETED', 'Completed'], ['REJECTED', 'Rejected'], ['', 'All']]} />}>
        <Table head={['Order', 'Customer', 'Reason', 'Requested', 'Status', 'Actions']} empty={returns.data?.data.length === 0}>
          {returns.isLoading ? (
            <LoadingRows cols={6} />
          ) : (
            returns.data?.data.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  <Link href={`/admin/orders/${r.order.orderNumber}`} className="text-plum-700 hover:underline">
                    {r.order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.user.name}</td>
                <td className="px-4 py-3">
                  {r.reason}
                  {r.details && <p className="text-xs text-ink-muted">{r.details}</p>}
                </td>
                <td className="px-4 py-3 text-ink-muted">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  {['REQUESTED', 'APPROVED'].includes(r.status) && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.status === 'REQUESTED' && (
                        <Button size="sm" variant="secondary" loading={busy === `a${r.id}`} onClick={() => void run(`a${r.id}`, () => admin.resolveReturn(r.id, 'APPROVE'), 'Approved')}>
                          Approve
                        </Button>
                      )}
                      <Button size="sm" loading={busy === `r${r.id}`} onClick={() => void run(`r${r.id}`, () => admin.resolveReturn(r.id, 'RECEIVE'), 'Received — refund created')}>
                        Received
                      </Button>
                      <Button size="sm" variant="ghost" loading={busy === `x${r.id}`} onClick={() => void run(`x${r.id}`, () => admin.resolveReturn(r.id, 'REJECT'), 'Rejected')}>
                        Reject
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
        <Pager meta={returns.data?.meta} onPage={setRPage} />
      </Panel>

      <Panel title="Refunds" actions={<FilterSelect label="Refund status" value={fStatus} onChange={(v) => { setFStatus(v); setFPage(1); }} options={[['PENDING', 'Pending'], ['FAILED', 'Failed'], ['PROCESSED', 'Processed'], ['', 'All']]} />}>
        <Table head={['Order', 'Customer', 'Amount', 'Reason', 'Method', 'Status', '']} empty={refunds.data?.data.length === 0}>
          {refunds.isLoading ? (
            <LoadingRows cols={7} />
          ) : (
            refunds.data?.data.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  <Link href={`/admin/orders/${r.order.orderNumber}`} className="text-plum-700 hover:underline">
                    {r.order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.order.user.name}</td>
                <td className="px-4 py-3 font-semibold">{formatPrice(r.amount)}</td>
                <td className="px-4 py-3 text-xs text-ink-soft">{r.reason}</td>
                <td className="px-4 py-3">{r.payment?.gateway ?? r.order.paymentMethod}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {r.gatewayRefundId && <p className="mt-0.5 font-mono text-[10px] text-ink-muted">{r.gatewayRefundId}</p>}
                </td>
                <td className="px-4 py-3">
                  {r.status !== 'PROCESSED' && (
                    <Button
                      size="sm"
                      loading={busy === r.id}
                      onClick={() => {
                        const manual = !r.payment || r.payment.gateway === 'COD' ? (prompt('Bank/UPI transaction reference:') ?? '') : undefined;
                        if (manual === '') return;
                        void run(r.id, () => admin.processRefund(r.id, manual), 'Refund processed');
                      }}
                    >
                      Process
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
        <Pager meta={refunds.data?.meta} onPage={setFPage} />
      </Panel>
    </div>
  );
}
