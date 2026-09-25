'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { admin, toPaise, toRupees, type CouponRow } from '@/services/admin';
import { LoadingRows, PageHeader, Panel, Table, Toggle } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { formatDate, formatPrice } from '@/utils/format';

const empty = { code: '', description: '', type: 'PERCENTAGE', value: '', minCartValue: '', maxDiscount: '', startsAt: '', expiresAt: '', usageLimit: '', perUserLimit: '1', categoryIds: [] as string[] };
const dateInput = (d: string | null) => (d ? d.slice(0, 10) : '');

export default function CouponsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ['admin-coupons'], queryFn: admin.coupons });
  const cats = useQuery({ queryKey: ['admin-categories'], queryFn: admin.categories });
  const [editing, setEditing] = useState<CouponRow | 'new' | null>(null);
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin-coupons'] });

  const open = (c: CouponRow | 'new') => {
    setF(
      c === 'new'
        ? empty
        : {
            code: c.code,
            description: c.description ?? '',
            type: c.type,
            value: c.type === 'FIXED' ? toRupees(c.value) : String(c.value),
            minCartValue: toRupees(c.minCartValue),
            maxDiscount: toRupees(c.maxDiscount),
            startsAt: dateInput(c.startsAt),
            expiresAt: dateInput(c.expiresAt),
            usageLimit: c.usageLimit ? String(c.usageLimit) : '',
            perUserLimit: String(c.perUserLimit),
            categoryIds: c.categories.map((x) => x.category.id),
          },
    );
    setEditing(c);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      code: f.code,
      description: f.description,
      type: f.type,
      value: f.type === 'FIXED' ? toPaise(f.value) : Number(f.value),
      minCartValue: f.minCartValue ? toPaise(f.minCartValue) : 0,
      maxDiscount: f.maxDiscount ? toPaise(f.maxDiscount) : null,
      startsAt: f.startsAt ? new Date(`${f.startsAt}T00:00:00+05:30`).toISOString() : null,
      expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59+05:30`).toISOString() : null,
      usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
      perUserLimit: Number(f.perUserLimit || 1),
      categoryIds: f.categoryIds,
    };
    try {
      if (editing === 'new') await admin.createCoupon(body);
      else if (editing) await admin.updateCoupon(editing.id, body);
      toast('Coupon saved');
      setEditing(null);
      refresh();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Coupons"
        description="All coupon rules are enforced server-side at checkout."
        actions={
          <Button size="sm" onClick={() => open('new')}>
            <Plus className="h-4 w-4" /> New coupon
          </Button>
        }
      />
      <Panel>
        <Table head={['Code', 'Discount', 'Conditions', 'Validity', 'Used', 'Active', '']} empty={list.data?.data.length === 0}>
          {list.isLoading ? (
            <LoadingRows cols={7} />
          ) : (
            list.data?.data.map((c) => {
              const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
              return (
                <tr key={c.id} className="hover:bg-ivory">
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-plum-700">{c.code}</p>
                    <p className="text-xs text-ink-muted">{c.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    {c.type === 'PERCENTAGE' ? `${c.value}%` : formatPrice(c.value)}
                    {c.maxDiscount ? <span className="block text-xs text-ink-muted">up to {formatPrice(c.maxDiscount)}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {c.minCartValue ? `Min ${formatPrice(c.minCartValue)}` : 'No minimum'}
                    <br />
                    {c.perUserLimit}/customer{c.categories.length ? ` · ${c.categories.map((x) => x.category.name).join(', ')}` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.expiresAt ? (expired ? <Badge tone="red">Expired</Badge> : `Till ${formatDate(c.expiresAt)}`) : 'No expiry'}
                  </td>
                  <td className="px-4 py-3">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <Toggle checked={c.isActive} onChange={(v) => void act(() => admin.updateCoupon(c.id, { isActive: v }), v ? 'Coupon enabled' : 'Coupon disabled')} label={`${c.code} active`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => open(c)} className="rounded-lg p-2 text-ink-muted hover:bg-sand" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => confirm(`Delete ${c.code}?`) && void act(() => admin.deleteCoupon(c.id), 'Coupon deleted')} className="rounded-lg p-2 text-ink-muted hover:text-danger" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </Table>
      </Panel>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New coupon' : 'Edit coupon'} size="lg">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Input label="Code" required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed amount (₹)</option>
          </Select>
          <Input label={f.type === 'PERCENTAGE' ? 'Percent off' : 'Amount off (₹)'} required inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          <Input label="Maximum discount (₹)" inputMode="decimal" value={f.maxDiscount} onChange={(e) => setF({ ...f, maxDiscount: e.target.value })} />
          <Input label="Minimum cart value (₹)" inputMode="decimal" value={f.minCartValue} onChange={(e) => setF({ ...f, minCartValue: e.target.value })} />
          <Input label="Per-customer limit" inputMode="numeric" value={f.perUserLimit} onChange={(e) => setF({ ...f, perUserLimit: e.target.value })} />
          <Input label="Total usage limit" inputMode="numeric" value={f.usageLimit} onChange={(e) => setF({ ...f, usageLimit: e.target.value })} hint="Empty = unlimited" />
          <div />
          <Input label="Starts on" type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
          <Input label="Expires on" type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-ink-soft">Limit to categories (optional)</legend>
            <div className="flex flex-wrap gap-3">
              {cats.data?.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-plum-700" checked={f.categoryIds.includes(c.id)} onChange={(e) => setF({ ...f, categoryIds: e.target.checked ? [...f.categoryIds, c.id] : f.categoryIds.filter((x) => x !== c.id) })} />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Textarea wrapClassName="sm:col-span-2" label="Description (shown to customers)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-[70px]" />
          <Button type="submit" loading={saving} className="sm:col-span-2">
            Save coupon
          </Button>
        </form>
      </Modal>
    </>
  );
}
