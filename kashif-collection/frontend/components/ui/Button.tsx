import { forwardRef, type ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 select-none';
const variants: Record<Variant, string> = {
  primary: 'bg-plum-700 text-white hover:bg-plum-800 active:scale-[.98] shadow-sm',
  secondary: 'bg-plum-50 text-plum-700 hover:bg-plum-100',
  outline: 'border border-plum-700 text-plum-700 hover:bg-plum-700 hover:text-white',
  ghost: 'text-ink-soft hover:bg-sand hover:text-ink',
  gold: 'bg-gold-400 text-plum-900 hover:bg-gold-500 hover:text-white shadow-sm',
  danger: 'bg-danger text-white hover:bg-danger/90',
};
const sizes: Record<Size, string> = { sm: 'h-9 px-4 text-sm', md: 'h-11 px-6 text-sm', lg: 'h-12 px-8 text-base' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, ...props },
  ref,
) {
  return (
    <button ref={ref} className={clsx(base, variants[variant], sizes[size], block && 'w-full', className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = 'primary', size = 'md', block, className, children }: { href: string; variant?: Variant; size?: Size; block?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx(base, variants[variant], sizes[size], block && 'w-full', className)}>
      {children}
    </Link>
  );
}
