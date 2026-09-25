'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, SlidersHorizontal } from 'lucide-react';
import { admin, type InventoryRow } from '@/services/admin';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingRows, PageHeader, Pager, Panel, SearchInput, Table } from '@/components/admin/ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { formatDateTime, titleCase } from '@/utils/format';

function InventoryView() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [low, setLow] = useState(params.get('lowStock') === 'true');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 300);
  const list = useQuery({ queryKey: ['admin-inventory', dq, low, page], queryFn: () => admin.inventory({ q: dq || undefined, lowStock: low || undefined, page, limit: 30 }), placeholderData: (p) => p });
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null);
  const [historyFor, setHistoryFor] = useState<InventoryRow | null>(null);
  const [adj, setAdj] = useState({ delta: '', type: 'RESTOCK' as 'RESTOCK' | 'ADJUSTMENT', reason: '', threshold: '' });
  const [saving, setSaving] = useState(false);
  const history = useQuery({ queryKey: ['admin-inv-history', historyFor?.variantId], queryFn: () => admin.history(historyFor!.variantId), enabled: Boolean(historyFor) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjusting) return;
    setSaving(true);
    try {
      await admin.adjust({ variantId: adjusting.variantId, delta: Number(adj.delta || 0), type: adj.type, reason: adj.reason, lowStockThreshold: adj.threshold ? Number(adj.threshold) : undefined });
      toast('Stock updated');
      setAdjusting(null);
      void qc.invalidateQueries({ queryKey: ['admin-inventory'] });
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Inventory" description="Available = total − reserved (units held by unpaid online orders). Every change is recorded in the audit trail." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Product, variant or SKU" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-plum-700" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} /> Low stock only
        </label>
      </div>
      <Panel>
        <Table head={['Product', 'SKU', 'Total', 'Reserved', 'Available', 'Alert at', '']} empty={list.data?.data.length === 0}>
          {list.isLoading ? (
            <LoadingRows cols={7} />
          ) : (
            list.data?.data.map((r) => (
              <tr key={r.id} className="hover:bg-ivory">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.variant.product.name}</p>
                  <p className="text-xs text-ink-muted">{r.variant.name}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.variant.sku}</td>
                <td className="px-4 py-3">{r.totalStock}</td>
                <td className="px-4 py-3">{r.reservedStock}</td>
                <td className="px-4 py-3 font-semibold">
                  {r.availableStock} {r.isLowStock && <Badge tone="red">{r.availableStock === 0 ? 'Out' : 'Low'}</Badge>}
                </td>
                <td className="px-4 py-3 text-ink-muted">{r.lowStockThreshold}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setAdj({ delta: '', type: 'RESTOCK', reason: '', threshold: String(r.lowStockThreshold) }); setAdjusting(r); }} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-plum-700 hover:bg-plum-50">
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust
                    </button>
                    <button onClick={() => setHistoryFor(r)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-soft hover:bg-sand">
                      <History className="h-3.5 w-3.5" /> History
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </Table>
        <Pager meta={list.data?.meta} onPage={setPage} />
      </Panel>

      <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} title="Adjust stock">
        {adjusting && (
          <form onSubmit={save} className="space-y-4">
            <p className="text-sm text-ink-soft">
              {adjusting.variant.product.name} · {adjusting.variant.name}
              <br />
              <span className="text-xs text-ink-muted">
                Now: {adjusting.totalStock} total, {adjusting.reservedStock} reserved, {adjusting.availableStock} available
              </span>
            </p>
            <Select label="Type" value={adj.type} onChange={(e) => setAdj({ ...adj, type: e.target.value as 'RESTOCK' | 'ADJUSTMENT' })}>
              <option value="RESTOCK">Restock (new stock received)</option>
              <option value="ADJUSTMENT">Adjustment (count correction, damage, loss)</option>
            </Select>
            <Input label="Change in units" inputMode="numeric" value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: e.target.value })} hint="Use a negative number to remove stock, e.g. -3" />
            <Input label="Reason" required value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="e.g. Supplier delivery #1123" />
            <Input label="Low-stock alert threshold" inputMode="numeric" value={adj.threshold} onChange={(e) => setAdj({ ...adj, threshold: e.target.value })} />
            <Button type="submit" block loading={saving}>
              Save
            </Button>
          </form>
        )}
      </Modal>

      <Modal open={historyFor !== null} onClose={() => setHistoryFor(null)} title="Stock history" size="lg">
        {history.isLoading ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {history.data?.data.items.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium">
                    {titleCase(h.type)} <span className={h.quantity >= 0 ? 'text-success' : 'text-danger'}>{h.quantity > 0 ? `+${h.quantity}` : h.quantity}</span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {h.reason ?? ''} {h.order && `· ${h.order.orderNumber}`} {h.performedBy && `· by ${h.performedBy.name}`}
                  </p>
                </div>
                <div className="text-right text-xs text-ink-muted">
                  <p>
                    Total {h.totalAfter} · Reserved {h.reservedAfter}
                  </p>
                  <p>{formatDateTime(h.createdAt)}</p>
                </div>
              </li>
            ))}
            {history.data?.data.items.length === 0 && <li className="py-6 text-center text-ink-muted">No movements yet.</li>}
          </ul>
        )}
      </Modal>
    </>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryView />
    </Suspense>
  );
}
