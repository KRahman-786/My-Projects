'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { catalog } from '@/services/catalog';
import { useDebounce } from '@/hooks/useDebounce';
import { formatPrice } from '@/utils/format';
import { SmartImage } from '@/components/ui/SmartImage';

export function SearchBox({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(q.trim(), 220);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['suggest', debounced],
    queryFn: () => catalog.suggestions(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    onNavigate?.();
    router.push(href);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const show = open && debounced.length >= 2;
  return (
    <div ref={boxRef} className={clsx('relative', className)}>
      <form onSubmit={submit} role="search">
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          id="site-search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search lipsticks, gota lace, jhumkas…"
          autoComplete="off"
          className="h-11 w-full rounded-full border border-line bg-ivory pl-11 pr-10 text-sm text-ink placeholder:text-ink-muted/80 focus:border-plum-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-plum-100"
        />
        {isFetching ? (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted" />
        ) : q ? (
          <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </form>

      {show && data && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          {data.products.length === 0 && data.categories.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-muted">No matches for “{debounced}”. Try another word.</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-line/60 overflow-y-auto">
              {data.categories.map((c) => (
                <li key={c.slug}>
                  <button onClick={() => go(`/category/${c.slug}`)} className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm hover:bg-ivory">
                    <span className="text-ink-muted">in</span> <span className="font-medium text-plum-700">{c.name}</span>
                  </button>
                </li>
              ))}
              {data.products.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/products/${p.category.slug}/${p.slug}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-ivory"
                  >
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-sand">
                      {p.image && <SmartImage src={p.image} alt="" fill sizes="48px" className="object-cover" />}
                    </span>
                    <span className="flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-ink">{p.name}</span>
                      <span className="text-xs text-ink-muted">{p.category.name}</span>
                    </span>
                    <span className="text-sm font-semibold">{formatPrice(p.price)}</span>
                  </Link>
                </li>
              ))}
              <li>
                <button onClick={() => go(`/search?q=${encodeURIComponent(debounced)}`)} className="w-full px-5 py-3 text-left text-sm font-semibold text-plum-700 hover:bg-ivory">
                  See all results for “{debounced}” →
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
