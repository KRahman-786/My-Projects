'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { misc } from '@/services/account';
import { ApiError, errorMessage } from '@/lib/api';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

export function ContactForm() {
  const [v, setV] = useState({ name: '', email: '', phone: '', subject: 'Order enquiry', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    setErrors({});
    try {
      await misc.contact({ ...v, phone: v.phone || undefined });
      setStatus('sent');
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) setErrors(Object.fromEntries((err.details as { field: string; message: string }[]).map((d) => [d.field, d.message])));
      setError(errorMessage(err));
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return (
      <div className="mt-8 rounded-2xl bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 font-semibold">Thank you, {v.name.split(' ')[0]}!</p>
        <p className="text-sm text-ink-soft">We&apos;ve received your message and will reply to {v.email} soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <Input label="Your name" required value={v.name} error={errors.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <Input label="Email" type="email" required value={v.email} error={errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      <Input label="Phone (optional)" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      <Select label="Subject" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })}>
        {['Order enquiry', 'Product question', 'Returns & refunds', 'Bulk / wholesale lace', 'Feedback', 'Other'].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <Textarea wrapClassName="sm:col-span-2" label="Message" required value={v.message} error={errors.message} onChange={(e) => setV({ ...v, message: e.target.value })} minLength={10} />
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" loading={status === 'sending'}>
          Send message
        </Button>
      </div>
    </form>
  );
}
