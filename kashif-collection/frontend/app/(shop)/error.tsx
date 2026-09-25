'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  const network = /fetch|network|ECONNREFUSED/i.test(error.message);
  return (
    <div className="container flex flex-col items-center py-24 text-center">
      <AlertTriangle className="h-10 w-10 text-danger" />
      <h1 className="mt-4 font-display text-3xl font-semibold">{network ? 'We’re having trouble connecting' : 'Something went wrong'}</h1>
      <p className="mt-2 max-w-md text-sm text-ink-muted">{network ? 'Please check your internet connection and try again.' : 'An unexpected error occurred. Please try again in a moment.'}</p>
      <button onClick={reset} className="mt-6 inline-flex h-11 items-center rounded-full bg-plum-700 px-6 text-sm font-semibold text-white">
        Try again
      </button>
    </div>
  );
}
