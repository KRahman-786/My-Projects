'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { admin, toPaise, toRupees, type StoreSettings } from '@/services/admin';
import { PageHeader, Panel, Toggle } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { INDIAN_STATES } from '@/lib/site';

const MONEY: (keyof StoreSettings)[] = ['codMinOrderValue', 'codMaxOrderValue', 'codFee', 'flatShippingFee', 'freeShippingThreshold'];

export default function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: admin.settings });
  const pins = useQuery({ queryKey: ['admin-pincodes'], queryFn: admin.pincodes });
  const [s, setS] = useState<Record<string, string | boolean>>({});
  const [pin, setPin] = useState({ pincode: '', city: '', state: '', isServiceable: true, codAvailable: true, deliveryDays: '5' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) setS(Object.fromEntries(Object.entries(q.data).map(([k, v]) => [k, typeof v === 'boolean' ? v : MONEY.includes(k as keyof StoreSettings) ? toRupees(v as number) : String(v)])));
  }, [q.data]);

  if (q.isLoading || !q.data) return <Spinner />;
  const str = (k: string) => String(s[k] ?? '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await admin.updateSettings({
        codEnabled: Boolean(s.codEnabled),
        pricesIncludeTax: Boolean(s.pricesIncludeTax),
        codMinOrderValue: toPaise(str('codMinOrderValue')),
        codMaxOrderValue: toPaise(str('codMaxOrderValue')),
        codFee: toPaise(str('codFee')),
        flatShippingFee: toPaise(str('flatShippingFee')),
        freeShippingThreshold: toPaise(str('freeShippingThreshold')),
        defaultGstRate: Number(str('defaultGstRate')),
        businessState: str('businessState'),
        orderReservationMinutes: Number(str('orderReservationMinutes')),
        returnWindowDays: Number(str('returnWindowDays')),
        defaultLowStockThreshold: Number(str('defaultLowStockThreshold')),
      });
      toast('Settings saved');
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await admin.upsertPincode({ ...pin, deliveryDays: Number(pin.deliveryDays), city: pin.city || undefined, state: pin.state || undefined });
      toast('Pincode rule saved');
      setPin({ pincode: '', city: '', state: '', isServiceable: true, codAvailable: true, deliveryDays: '5' });
      void pins.refetch();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Store settings" description="Business rules used by the pricing, shipping and order services." />
      <form onSubmit={save} className="grid gap-5 xl:grid-cols-3">
        <Panel title="Cash on Delivery">
          <div className="space-y-4 p-5">
            <label className="flex items-center justify-between text-sm">
              COD enabled <Toggle checked={Boolean(s.codEnabled)} onChange={(v) => setS({ ...s, codEnabled: v })} label="COD enabled" />
            </label>
            <Input label="Minimum order value (₹)" inputMode="decimal" value={str('codMinOrderValue')} onChange={(e) => setS({ ...s, codMinOrderValue: e.target.value })} />
            <Input label="Maximum order value (₹)" inputMode="decimal" value={str('codMaxOrderValue')} onChange={(e) => setS({ ...s, codMaxOrderValue: e.target.value })} />
            <Input label="COD handling fee (₹)" inputMode="decimal" value={str('codFee')} onChange={(e) => setS({ ...s, codFee: e.target.value })} />
          </div>
        </Panel>
        <Panel title="Shipping & orders">
          <div className="space-y-4 p-5">
            <Input label="Flat shipping fee (₹)" inputMode="decimal" value={str('flatShippingFee')} onChange={(e) => setS({ ...s, flatShippingFee: e.target.value })} />
            <Input label="Free shipping above (₹)" inputMode="decimal" value={str('freeShippingThreshold')} onChange={(e) => setS({ ...s, freeShippingThreshold: e.target.value })} />
            <Input label="Hold stock for unpaid online orders (minutes)" inputMode="numeric" value={str('orderReservationMinutes')} onChange={(e) => setS({ ...s, orderReservationMinutes: e.target.value })} />
            <Input label="Return window (days)" inputMode="numeric" value={str('returnWindowDays')} onChange={(e) => setS({ ...s, returnWindowDays: e.target.value })} />
            <Input label="Default low-stock threshold" inputMode="numeric" value={str('defaultLowStockThreshold')} onChange={(e) => setS({ ...s, defaultLowStockThreshold: e.target.value })} />
          </div>
        </Panel>
        <Panel title="Tax (GST)">
          <div className="space-y-4 p-5">
            <label className="flex items-center justify-between text-sm">
              Prices include GST <Toggle checked={Boolean(s.pricesIncludeTax)} onChange={(v) => setS({ ...s, pricesIncludeTax: v })} label="Prices include GST" />
            </label>
            <Input label="Default GST rate for new products (%)" inputMode="decimal" value={str('defaultGstRate')} onChange={(e) => setS({ ...s, defaultGstRate: e.target.value })} />
            <Select label="Seller's GST state" value={str('businessState')} onChange={(e) => setS({ ...s, businessState: e.target.value })}>
              {INDIAN_STATES.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </Select>
            <p className="text-xs text-ink-muted">Deliveries within this state are billed CGST + SGST; other states IGST. Per-product rates are set on each product.</p>
            <Button type="submit" block loading={saving}>
              Save settings
            </Button>
          </div>
        </Panel>
      </form>

      <Panel title="Pincode rules">
        <div className="p-5">
          <p className="mb-4 text-sm text-ink-muted">Override serviceability, COD and delivery time for specific pincodes. Others use zone rules (Shahjahanpur 2 days, UP/UK 4, North 5, NE/islands 8, rest 6).</p>
          <form onSubmit={savePin} className="grid gap-3 md:grid-cols-7">
            <Input label="Pincode" required value={pin.pincode} onChange={(e) => setPin({ ...pin, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
            <Input label="City" value={pin.city} onChange={(e) => setPin({ ...pin, city: e.target.value })} />
            <Input label="State" value={pin.state} onChange={(e) => setPin({ ...pin, state: e.target.value })} />
            <Input label="Delivery days" inputMode="numeric" value={pin.deliveryDays} onChange={(e) => setPin({ ...pin, deliveryDays: e.target.value })} />
            <label className="flex items-end gap-2 pb-3 text-sm">
              <input type="checkbox" className="accent-plum-700" checked={pin.isServiceable} onChange={(e) => setPin({ ...pin, isServiceable: e.target.checked })} /> Serviceable
            </label>
            <label className="flex items-end gap-2 pb-3 text-sm">
              <input type="checkbox" className="accent-plum-700" checked={pin.codAvailable} onChange={(e) => setPin({ ...pin, codAvailable: e.target.checked })} /> COD
            </label>
            <div className="flex items-end">
              <Button type="submit" block>
                Save
              </Button>
            </div>
          </form>
          <ul className="mt-5 divide-y divide-line text-sm">
            {pins.data?.map((p) => (
              <li key={p.pincode} className="flex items-center justify-between py-2">
                <span>
                  <b className="font-mono">{p.pincode}</b> {p.city && `· ${p.city}`} {p.state && `, ${p.state}`} · {p.deliveryDays} days · {p.isServiceable ? 'serviceable' : <span className="text-danger">not serviceable</span>} · {p.codAvailable ? 'COD' : 'prepaid only'}
                </span>
                <button onClick={() => void admin.deletePincode(p.pincode).then(() => pins.refetch())} className="p-1.5 text-ink-muted hover:text-danger" aria-label={`Remove ${p.pincode}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>
  );
}
