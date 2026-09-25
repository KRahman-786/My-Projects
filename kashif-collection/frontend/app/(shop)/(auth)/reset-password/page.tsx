'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { auth } from '@/services/account';
import { errorMessage } from '@/lib/api';
import { AuthShell } from '@/components/account/AuthShell';
import { Input } from '@/components/ui/Field';
import { Button, ButtonLink } from '@/components/ui/Button';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('Passwords do not match');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError('Use at least 8 characters with a letter and a number');
    setLoading(true);
    setError('');
    try {
      await auth.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid link">
        <p className="text-sm text-ink-soft">This password reset link is incomplete.</p>
        <Link href="/forgot-password" className="mt-4 inline-block font-semibold text-plum-700">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password">
      {done ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-semibold">Your password has been updated</p>
          <p className="mt-1 text-sm text-ink-muted">For your security, you have been signed out of all devices.</p>
          <ButtonLink href="/login" className="mt-6">
            Log in
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Input label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input label="Confirm password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" block loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
