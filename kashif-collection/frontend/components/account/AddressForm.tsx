'use client';

import { useState } from 'react';
import { Input, Select, Checkbox } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { INDIAN_STATES } from '@/lib/site';
import { addresses, type AddressInput } from '@/services/account';
import { ApiError, errorMessage } from '@/lib/api';
import type { Address } from '@/types';

type Errors = Partial<Record<keyof AddressInput, string>>;

function validate(v: AddressInput): Errors {
  const e: Errors = {};
  if (v.name.trim().length < 2) e.name = 'Enter the recipient name';
  if (!/^(\+91)?[6-9]\d{9}$/.test(v.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a valid 10-digit mobile number';
  if (!v.house.trim()) e.house = 'Required';
  if (!v.street.trim()) e.street = 'Required';
  if (v.city.trim().length < 2) e.city = 'Required';
  if (!/^[1-9]\d{5}$/.test(v.pincode)) e.pincode = 'Enter a valid 6-digit pincode';
  return e;
}

export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [v, setV] = useState<AddressInput>({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    house: initial?.house ?? '',
    street: initial?.street ?? '',
    area: initial?.area ?? '',
    landmark: initial?.landmark ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? 'Uttar Pradesh',
    pincode: initial?.pincode ?? '',
    country: 'India',
    isDefault: initial?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setFormError('');
    try {
      const body = { ...v, area: v.area || undefined, landmark: v.landmark || undefined } as AddressInput;
      onSaved(initial ? await addresses.update(initial.id, body) : await addresses.create(body));
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        setErrors(Object.fromEntries((err.details as { field: string; message: string }[]).map((d) => [d.field, d.message])));
      }
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Input label="Full name" name="name" required value={v.name} onChange={set('name')} error={errors.name} autoComplete="name" />
      <Input label="Mobile number" name="phone" required value={v.phone} onChange={set('phone')} error={errors.phone} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" />
      <Input label="House / Flat / Building" name="house" required value={v.house} onChange={set('house')} error={errors.house} autoComplete="address-line1" />
      <Input label="Street / Road" name="street" required value={v.street} onChange={set('street')} error={errors.street} autoComplete="address-line2" />
      <Input label="Area / Locality" name="area" value={v.area ?? ''} onChange={set('area')} />
      <Input label="Landmark" name="landmark" value={v.landmark ?? ''} onChange={set('landmark')} placeholder="Near…" />
      <Input label="Pincode" name="pincode" required value={v.pincode} onChange={(e) => setV((s) => ({ ...s, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} error={errors.pincode} inputMode="numeric" autoComplete="postal-code" />
      <Input label="City / District" name="city" required value={v.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" />
      <Select label="State" name="state" required value={v.state} onChange={set('state')}>
        {INDIAN_STATES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <Input label="Country" name="country" value="India" disabled />
      <Checkbox className="sm:col-span-2" label="Make this my default address" checked={Boolean(v.isDefault)} onChange={(e) => setV((s) => ({ ...s, isDefault: e.target.checked }))} />
      {formError && <p className="text-sm text-danger sm:col-span-2">{formError}</p>}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" loading={saving}>
          {initial ? 'Save changes' : 'Save address'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function AddressText({ a }: { a: Pick<Address, 'name' | 'phone' | 'house' | 'street' | 'area' | 'landmark' | 'city' | 'state' | 'pincode'> }) {
  return (
    <div className="text-sm leading-relaxed text-ink-soft">
      <p className="font-semibold text-ink">{a.name}</p>
      <p>
        {a.house}, {a.street}
        {a.area ? `, ${a.area}` : ''}
      </p>
      {a.landmark && <p>{a.landmark}</p>}
      <p>
        {a.city}, {a.state} – {a.pincode}
      </p>
      <p className="mt-1">📞 {a.phone}</p>
    </div>
  );
}
