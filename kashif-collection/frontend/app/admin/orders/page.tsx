'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { admin } from '@/services/admin';
import { useDebounce } from '@/hooks/useDebounce';
import { FilterSelect, LoadingRows, PageHeader, Pager, Panel, SearchInput, Table } from '@/components/admin/ui';
import { Badge, statusTone } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/EmptyState';
import { formatDateTime, formatPrice, ORDER_STATUS_LABEL } from '@/utils/format';

const STATUS_OPTS: [string, string][] = [['', 'All statuses'], ...Object.entries(ORDER_STATUS_LABEL)];

function OrdersList() {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [payment, setPayment] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 300);
  const query = useQuery({
    queryKey: ['admin-orders', dq, status, payment, method, from, to, page],
    queryFn: () => admin.orders({ q: dq || undefined, status: status || undefined, paymentStatus: payment || undefined, paymentMethod: method || undefined, from: from || undefined, to: to ? `${to}T23:59:59` : undefined, page, limit: 20 }),
    placeholderData: (p) => p,
  });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Orders" description="Search, filter and manage customer orders." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={reset(setQ)} placeholder="Order no., name, phone, email" />
        <FilterSelect label="Status" value={status} onChange={reset(setStatus)} options={STATUS_OPTS} />
        <FilterSelect label="Payment status" value={payment} onChange={reset(setPayment)} options={[['', 'Any payment'], ['PENDING', 'Pending'], ['PAID', 'Paid'], ['FAILED', 'Failed'], ['REFUNDED', 'Refunded']]} />
        <FilterSelect label="Payment method" value={method} onChange={reset(setMethod)} options={[['', 'All methods'], ['COD', 'COD'], ['RAZORPAY', 'Razorpay'], ['STRIPE', 'Stripe']]} />
        <input type="date" aria-label="From date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm" />
        <input type="date" aria-label="To date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm" />
      </div>
      <Panel>
        {query.isError ? (
          <div className="p-6">
            <ErrorState message="Could not load orders." onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <Table head={['Order', 'Customer', 'Placed', 'Items', 'Payment', 'Status', 'Total']} empty={query.data?.data.length === 0}>
            {query.isLoading ? (
              <LoadingRows cols={7} />
            ) : (
              query.data?.data.map((o) => (
                <tr key={o.orderNumber} className="hover:bg-ivory">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                    <Link href={`/admin/orders/${o.orderNumber}`} className="text-plum-700 hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.shipName}</p>
                    <p className="text-xs text-ink-muted">{o.user.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3">{o._count.items}</td>
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
              ))
            )}
          </Table>
        )}
        <Pager meta={query.data?.meta} onPage={setPage} />
      </Panel>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense>
      <OrdersList />
    </Suspense>
  );
}
