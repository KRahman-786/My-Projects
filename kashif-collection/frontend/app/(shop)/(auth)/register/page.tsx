'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '@/services/account';
import { ApiError, errorMessage } from '@/lib/api';
import { AuthShell } from '@/components/account/AuthShell';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [v, setV] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.name.trim().length < 2) errs.name = 'Please enter your name';
    if (v.phone && !/^(\+91)?[6-9]\d{9}$/.test(v.phone.replace(/\s/g, ''))) errs.phone = 'Enter a valid 10-digit mobile number';
    if (v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) errs.password = 'At least 8 characters with a letter and a number';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError('');
    try {
      const { user } = await auth.register({ name: v.name, email: v.email, password: v.password, phone: v.phone || undefined });
      qc.setQueryData(['me'], user);
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/account');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) setErrors(Object.fromEntries((err.details as { field: string; message: string }[]).map((d) => [d.field, d.message])));
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-plum-700">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Full name" name="name" autoComplete="name" required value={v.name} error={errors.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <Input label="Email" type="email" name="email" autoComplete="email" required value={v.email} error={errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <Input label="Mobile (optional)" name="phone" inputMode="tel" autoComplete="tel" value={v.phone} error={errors.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} hint="For delivery updates" />
        <Input label="Password" type="password" name="password" autoComplete="new-password" required value={v.password} error={errors.password} hint="At least 8 characters, including a letter and a number" onChange={(e) => setV({ ...v, password: e.target.value })} />
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block loading={loading}>
          Create account
        </Button>
        <p className="text-center text-xs text-ink-muted">
          By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
