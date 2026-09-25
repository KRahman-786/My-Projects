import clsx from 'clsx';
import type { ReactNode } from 'react';

const tones = {
  plum: 'bg-plum-50 text-plum-700',
  gold: 'bg-gold-100 text-gold-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-sand text-ink-soft',
  blue: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
};
export type BadgeTone = keyof typeof tones;

export function Badge({ children, tone = 'plum', className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider', tones[tone], className)}>{children}</span>;
}

export function statusTone(status: string): BadgeTone {
  if (['DELIVERED', 'PAID', 'APPROVED', 'PROCESSED', 'COMPLETED'].includes(status)) return 'green';
  if (['CANCELLED', 'FAILED', 'REJECTED', 'HIDDEN'].includes(status)) return 'red';
  if (['REFUNDED', 'RETURNED'].includes(status)) return 'gray';
  if (['SHIPPED', 'OUT_FOR_DELIVERY', 'PACKED', 'RECEIVED'].includes(status)) return 'blue';
  if (['PENDING', 'RETURN_REQUESTED', 'REQUESTED', 'AUTHORIZED'].includes(status)) return 'amber';
  return 'plum';
}
