import Link from 'next/link';
import clsx from 'clsx';

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={clsx('group inline-flex flex-col leading-none', className)} aria-label="Kashif Collection — home">
      <span className={clsx('font-display text-[26px] font-semibold tracking-[0.02em] md:text-[30px]', light ? 'text-white' : 'text-plum-700')}>
        Kashif <span className="italic text-gold-500">Collection</span>
      </span>
      <span className={clsx('mt-1 hidden text-[9px] font-medium uppercase tracking-[0.38em] sm:block', light ? 'text-gold-200' : 'text-ink-muted')}>Shahjahanpur · Uttar Pradesh</span>
    </Link>
  );
}
