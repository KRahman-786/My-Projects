'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '@/services/admin';
import { PageHeader, Panel, Table } from '@/components/admin/ui';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';
import { AddressText } from '@/components/account/AddressForm';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatPrice, ORDER_STATUS_LABEL } from '@/utils/format';

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-customer', id], queryFn: () => admin.customer(id) });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState message="Customer not found." />;
  const c = q.data;

  const toggle = async () => {
    if (c.isActive && !confirm(`Deactivate ${c.name}? They will be signed out and unable to log in.`)) return;
    try {
      await admin.setCustomerActive(c.id, !c.isActive);
      toast(c.isActive ? 'Customer deactivated' : 'Customer reactivated');
      void qc.invalidateQueries({ queryKey: ['admin-customer', id] });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/admin/customers" className="text-sm text-ink-muted hover:text-plum-700">
        ← Customers
      </Link>
      <PageHeader
        title={c.name}
        description={`${c.email}${c.phone ? ` · ${c.phone}` : ''}`}
        actions={
          <Button variant={c.isActive ? 'danger' : 'primary'} size="sm" onClick={() => void toggle()}>
            {c.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Status', c.isActive ? 'Active' : 'Deactivated'],
          ['Orders', String(c._count.orders)],
          ['Total spent', formatPrice(c.totalSpent)],
          ['Member since', formatDate(c.createdAt)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs text-ink-muted">{k}</p>
            <p className="mt-1 text-lg font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <Panel title="Orders">
        <Table head={['Order', 'Date', 'Payment', 'Status', 'Total']} empty={!c.orders.length}>
          {c.orders.map((o) => (
            <tr key={o.orderNumber} className="hover:bg-ivory">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                <Link href={`/admin/orders/${o.orderNumber}`} className="text-plum-700 hover:underline">
                  {o.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3 text-ink-muted">{formatDateTime(o.createdAt)}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(o.paymentStatus)}>
                  {o.paymentMethod} · {o.paymentStatus.toLowerCase()}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
              </td>
              <td className="px-4 py-3 font-semibold">{formatPrice(o.grandTotal)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title="Saved addresses">
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {c.addresses.length ? c.addresses.map((a) => <AddressText key={a.id} a={a} />) : <p className="text-sm text-ink-muted">No saved addresses.</p>}
        </div>
      </Panel>
      <p className="text-xs text-ink-muted">Last login: {c.lastLoginAt ? formatDateTime(c.lastLoginAt) : 'never'} · Reviews written: {c._count.reviews}</p>
    </div>
  );
}
