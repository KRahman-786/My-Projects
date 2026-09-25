'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { admin } from '@/services/admin';
import { useDebounce } from '@/hooks/useDebounce';
import { FilterSelect, LoadingRows, PageHeader, Pager, Panel, SearchInput, Table, Toggle } from '@/components/admin/ui';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SmartImage } from '@/components/ui/SmartImage';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { formatPrice } from '@/utils/format';

export default function AdminProductsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 300);
  const cats = useQuery({ queryKey: ['admin-categories'], queryFn: admin.categories });
  const query = useQuery({
    queryKey: ['admin-products', dq, status, categoryId, page],
    queryFn: () => admin.products({ q: dq || undefined, status, categoryId: categoryId || undefined, page, limit: 20 }),
    placeholderData: (p) => p,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin-products'] });

  const toggle = async (id: string, isActive: boolean) => {
    try {
      await admin.setProductActive(id, isActive);
      toast(isActive ? 'Product activated' : 'Product hidden from the store');
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete “${name}”? It will be archived; past orders keep their records.`)) return;
    try {
      await admin.deleteProduct(id);
      toast('Product archived');
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <ButtonLink href="/admin/products/new" size="sm">
            <Plus className="h-4 w-4" /> Add product
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name or SKU" />
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']]} />
        <FilterSelect label="Category" value={categoryId} onChange={(v) => { setCategoryId(v); setPage(1); }} options={[['', 'All categories'], ...((cats.data ?? []).map((c) => [c.id, c.name]) as [string, string][])]} />
      </div>
      <Panel>
        <Table head={['Product', 'SKU', 'Category', 'Price', 'Stock (avail / reserved)', 'Active', '']} empty={query.data?.data.length === 0}>
          {query.isLoading ? (
            <LoadingRows cols={7} />
          ) : (
            query.data?.data.map((p) => (
              <tr key={p.id} className="hover:bg-ivory">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="relative h-11 w-10 shrink-0 overflow-hidden rounded-lg bg-sand">{p.images[0] && <SmartImage src={p.images[0].url} alt="" fill sizes="40px" className="object-cover" />}</span>
                    <div>
                      <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-plum-700">
                        {p.name}
                      </Link>
                      <p className="text-xs text-ink-muted">{p.variantCount} variant(s)</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3">{p.category.name}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{formatPrice(p.price)}</p>
                  <p className="text-xs text-ink-muted line-through">{formatPrice(p.mrp)}</p>
                </td>
                <td className="px-4 py-3">
                  {p.stock.available} / {p.stock.reserved} {p.stock.low && <Badge tone="red">Low</Badge>}
                </td>
                <td className="px-4 py-3">
                  <Toggle checked={p.isActive} onChange={(v) => void toggle(p.id, v)} label={`Active: ${p.name}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <a href={`/products/shop/${p.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-ink-muted hover:bg-sand" aria-label="View in store">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <Link href={`/admin/products/${p.id}`} className="rounded-lg p-2 text-ink-muted hover:bg-sand" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button onClick={() => void remove(p.id, p.name)} className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-danger" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </Table>
        <Pager meta={query.data?.meta} onPage={setPage} />
      </Panel>
    </>
  );
}
