'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { auth } from '@/services/account';
import { errorMessage } from '@/lib/api';
import { AuthShell } from '@/components/account/AuthShell';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot password?" subtitle="Enter your email and we'll send you a link to reset it.">
      {sent ? (
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-success" />
          <p className="mt-3 font-semibold">Check your inbox</p>
          <p className="mt-1 text-sm text-ink-soft">If an account exists for {email}, a reset link is on its way. The link expires in 30 minutes.</p>
          <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-plum-700">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Input label="Email" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" block loading={loading}>
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="font-semibold text-plum-700">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
