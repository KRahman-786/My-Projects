'use client';

import { useState } from 'react';
import { MapPin, Truck, Loader2 } from 'lucide-react';
import { misc } from '@/services/account';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/utils/format';
import type { Serviceability } from '@/types';

export function PincodeChecker() {
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<Serviceability | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[1-9]\d{5}$/.test(pin)) return setError('Enter a valid 6-digit pincode');
    setLoading(true);
    setError('');
    try {
      setResult(await misc.pincode(pin));
    } catch (err) {
      setError(errorMessage(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-plum-600" /> Check delivery
      </p>
      <form onSubmit={check} className="mt-3 flex gap-2">
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="Enter pincode" aria-label="Pincode" className="h-10 flex-1 rounded-full border border-line px-4 text-sm" />
        <button className="h-10 rounded-full border border-plum-700 px-5 text-sm font-semibold text-plum-700 hover:bg-plum-700 hover:text-white">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}</button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {result &&
        (result.serviceable ? (
          <div className="mt-3 space-y-1 text-sm">
            <p className="flex items-center gap-2 text-success">
              <Truck className="h-4 w-4" /> Delivery by <b>{formatDate(result.estimatedDeliveryDate, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
            </p>
            <p className="text-xs text-ink-muted">{result.codAvailable ? 'Cash on Delivery available' : 'Prepaid orders only for this pincode'}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-danger">Sorry, we don&apos;t deliver to {result.pincode} yet.</p>
        ))}
    </div>
  );
}
