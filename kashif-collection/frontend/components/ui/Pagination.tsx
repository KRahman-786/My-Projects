import Link from 'next/link';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Link-based pagination (crawlable). `hrefFor` builds the URL for a page. */
export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const cls = 'flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm transition';
  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={clsx(cls, 'hover:bg-sand')} aria-label="Previous page" rel="prev">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={clsx(cls, 'opacity-30')}>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - sorted[i - 1]! > 1 && <span className="px-1 text-ink-muted">…</span>}
          <Link href={hrefFor(p)} aria-current={p === page ? 'page' : undefined} className={clsx(cls, p === page ? 'bg-plum-700 text-white' : 'hover:bg-sand')}>
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={clsx(cls, 'hover:bg-sand')} aria-label="Next page" rel="next">
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={clsx(cls, 'opacity-30')}>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
