import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ivory px-6 text-center">
      <p className="font-display text-8xl font-semibold text-plum-200">404</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-ink-muted">The product may have been moved or is no longer available. Let&apos;s get you back to something beautiful.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-plum-700 px-6 text-sm font-semibold text-white">
          Go home
        </Link>
        <Link href="/products" className="inline-flex h-11 items-center rounded-full border border-plum-700 px-6 text-sm font-semibold text-plum-700">
          Shop products
        </Link>
      </div>
    </div>
  );
}
