'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { admin } from '@/services/admin';
import { useDebounce } from '@/hooks/useDebounce';
import { FilterSelect, LoadingRows, PageHeader, Pager, Panel, SearchInput, Table } from '@/components/admin/ui';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatPrice } from '@/utils/format';

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 300);
  const list = useQuery({ queryKey: ['admin-customers', dq, status, page], queryFn: () => admin.customers({ q: dq || undefined, status: status || undefined, page, limit: 20 }), placeholderData: (p) => p });
  return (
    <>
      <PageHeader title="Customers" />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Name, email or phone" />
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[['', 'All'], ['active', 'Active'], ['inactive', 'Deactivated']]} />
      </div>
      <Panel>
        <Table head={['Customer', 'Phone', 'Joined', 'Orders', 'Total spent', 'Status']} empty={list.data?.data.length === 0}>
          {list.isLoading ? (
            <LoadingRows cols={6} />
          ) : (
            list.data?.data.map((c) => (
              <tr key={c.id} className="hover:bg-ivory">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium hover:text-plum-700">
                    {c.name}
                  </Link>
                  <p className="text-xs text-ink-muted">{c.email}</p>
                </td>
                <td className="px-4 py-3">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-ink-muted">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3">{c.orderCount}</td>
                <td className="px-4 py-3 font-semibold">{formatPrice(c.totalSpent)}</td>
                <td className="px-4 py-3">{c.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</td>
              </tr>
            ))
          )}
        </Table>
        <Pager meta={list.data?.meta} onPage={setPage} />
      </Panel>
    </>
  );
}
