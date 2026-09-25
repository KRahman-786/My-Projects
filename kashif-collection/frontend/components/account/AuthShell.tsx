import type { ReactNode } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="container py-10 md:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-lift md:grid-cols-2">
        <div className="relative hidden min-h-[560px] bg-blush md:block">
          <SmartImage src="/images/products/royal-kundan-bridal-necklace-set-1.svg" alt="" fill sizes="50vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-plum-900/85 via-plum-900/20 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 text-white">
            <p className="font-display text-4xl font-semibold leading-tight">
              Beauty, lace &amp; jewels —<br />
              <span className="italic text-gold-200">all in one place.</span>
            </p>
            <p className="mt-3 text-sm text-plum-100">Track orders, save addresses, build your wishlist and get member-only offers.</p>
          </div>
        </div>
        <div className="p-7 sm:p-10 md:p-12">
          <h1 className="font-display text-4xl font-semibold">{title}</h1>
          {subtitle && <div className="mt-2 text-sm text-ink-muted">{subtitle}</div>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
