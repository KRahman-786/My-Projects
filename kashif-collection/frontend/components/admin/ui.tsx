'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { PaginationMeta } from '@/types';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-2xl border border-line bg-white', className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm focus:border-plum-300 focus:outline-none" />
    </label>
  );
}

export function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-sm">
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-ivory text-[11px] uppercase tracking-wider text-ink-muted">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="py-12 text-center text-sm text-ink-muted">Nothing to show.</p>}
    </div>
  );
}

export function Pager({ meta, onPage }: { meta?: PaginationMeta; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
      <span className="text-ink-muted">
        {meta.total} results · page {meta.page} of {meta.totalPages}
      </span>
      <div className="flex gap-1">
        <button disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} className="rounded-lg p-2 hover:bg-sand disabled:opacity-30" aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} className="rounded-lg p-2 hover:bg-sand disabled:opacity-30" aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function LoadingRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded bg-sand" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={clsx('relative h-6 w-11 rounded-full transition', checked ? 'bg-success' : 'bg-line')}>
      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}
