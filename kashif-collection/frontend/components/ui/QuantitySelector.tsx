'use client';

import { Minus, Plus } from 'lucide-react';
import clsx from 'clsx';

export function QuantitySelector({ value, onChange, min = 1, max = 10, disabled, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean; size?: 'sm' | 'md' }) {
  const btn = clsx('flex items-center justify-center text-ink-soft transition hover:text-plum-700 disabled:opacity-30', size === 'sm' ? 'h-8 w-8' : 'h-11 w-11');
  return (
    <div className={clsx('inline-flex items-center rounded-full border border-line bg-white', disabled && 'opacity-60')}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className={clsx('min-w-8 text-center font-medium tabular-nums', size === 'sm' ? 'text-sm' : 'text-base')} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
