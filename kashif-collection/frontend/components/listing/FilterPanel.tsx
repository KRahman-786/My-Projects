'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Facets, Subcategory } from '@/types';

const RATINGS = [4, 3];
const DISCOUNTS = [10, 25, 40];

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { params, update, pending };
}

function toggleCsv(current: string | null, value: string) {
  const set = new Set((current ?? '').split(',').filter(Boolean));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set].join(',') || null;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-line py-5 first:pt-0">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function FilterBody({ facets, subcategories, categorySlug }: { facets: Facets; subcategories?: Subcategory[]; categorySlug?: string }) {
  const { params, update, pending } = useParamUpdater();
  const [min, setMin] = useState(params.get('minPrice') ?? '');
  const [max, setMax] = useState(params.get('maxPrice') ?? '');
  useEffect(() => {
    setMin(params.get('minPrice') ?? '');
    setMax(params.get('maxPrice') ?? '');
  }, [params]);
  const pathname = usePathname();

  const brands = (params.get('brand') ?? '').split(',').filter(Boolean);
  const colors = (params.get('color') ?? '').split(',').filter(Boolean);
  const sizes = (params.get('size') ?? '').split(',').filter(Boolean);

  return (
    <div className={clsx('transition-opacity', pending && 'pointer-events-none opacity-60')} aria-busy={pending}>
      {subcategories && subcategories.length > 0 && categorySlug && (
        <Group title="Category">
          <ul className="space-y-1.5 text-sm">
            <li>
              <Link href={`/category/${categorySlug}`} className={clsx('hover:text-plum-700', pathname === `/category/${categorySlug}` ? 'font-semibold text-plum-700' : 'text-ink-soft')}>
                All
              </Link>
            </li>
            {subcategories.map((s) => (
              <li key={s.id}>
                <Link href={`/category/${categorySlug}/${s.slug}`} className={clsx('hover:text-plum-700', pathname.endsWith(`/${s.slug}`) ? 'font-semibold text-plum-700' : 'text-ink-soft')}>
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </Group>
      )}

      <Group title="Price (₹)">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ minPrice: min || null, maxPrice: max || null });
          }}
        >
          <input value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={`${Math.floor(facets.priceRange.min / 100)}`} aria-label="Minimum price" className="h-10 w-full rounded-lg border border-line px-3 text-sm" />
          <span className="text-ink-muted">–</span>
          <input value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={`${Math.ceil(facets.priceRange.max / 100)}`} aria-label="Maximum price" className="h-10 w-full rounded-lg border border-line px-3 text-sm" />
          <button className="h-10 shrink-0 rounded-lg bg-plum-700 px-3 text-xs font-semibold text-white">Go</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['Under ₹300', null, '300'],
            ['₹300–700', '300', '700'],
            ['₹700–1500', '700', '1500'],
            ['Above ₹1500', '1500', null],
          ].map(([label, lo, hi]) => (
            <button key={label} onClick={() => update({ minPrice: lo ?? null, maxPrice: hi ?? null })} className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft hover:border-plum-300">
              {label}
            </button>
          ))}
        </div>
      </Group>

      {facets.brands.length > 1 && (
        <Group title="Brand">
          <ul className="space-y-2">
            {facets.brands.map((b) => (
              <li key={b.name}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
                  <input type="checkbox" className="h-4 w-4 accent-plum-700" checked={brands.includes(b.name)} onChange={() => update({ brand: toggleCsv(params.get('brand'), b.name) })} />
                  <span className="flex-1">{b.name}</span>
                  <span className="text-xs text-ink-muted">{b.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </Group>
      )}

      {facets.colors.length > 0 && (
        <Group title="Colour / Shade">
          <div className="flex flex-wrap gap-2.5">
            {facets.colors.map((c) => {
              const active = colors.includes(c.name);
              return (
                <button key={c.name} onClick={() => update({ color: toggleCsv(params.get('color'), c.name) })} title={c.name} aria-pressed={active} className="group flex flex-col items-center gap-1">
                  <span className={clsx('flex h-8 w-8 items-center justify-center rounded-full border-2 transition', active ? 'border-plum-700' : 'border-transparent group-hover:border-line')}>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10" style={{ background: c.hex ?? '#e5e5e5' }}>
                      {active && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" />}
                    </span>
                  </span>
                  <span className="max-w-[56px] truncate text-[10px] text-ink-muted">{c.name}</span>
                </button>
              );
            })}
          </div>
        </Group>
      )}

      {facets.sizes.length > 0 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button key={s} onClick={() => update({ size: toggleCsv(params.get('size'), s) })} aria-pressed={sizes.includes(s)} className={clsx('rounded-lg border px-3 py-1.5 text-xs', sizes.includes(s) ? 'border-plum-700 bg-plum-700 text-white' : 'border-line text-ink-soft hover:border-plum-300')}>
                {s}
              </button>
            ))}
          </div>
        </Group>
      )}

      <Group title="Customer rating">
        <div className="space-y-2">
          {RATINGS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
              <input type="radio" name="rating" className="accent-plum-700" checked={params.get('rating') === String(r)} onChange={() => update({ rating: String(r) })} />
              {r}★ &amp; above
            </label>
          ))}
        </div>
      </Group>

      <Group title="Discount">
        <div className="space-y-2">
          {DISCOUNTS.map((d) => (
            <label key={d} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
              <input type="radio" name="discount" className="accent-plum-700" checked={params.get('minDiscount') === String(d)} onChange={() => update({ minDiscount: String(d) })} />
              {d}% or more
            </label>
          ))}
        </div>
      </Group>

      <Group title="Availability">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
          <input type="checkbox" className="h-4 w-4 accent-plum-700" checked={params.get('inStock') === 'true'} onChange={(e) => update({ inStock: e.target.checked ? 'true' : null })} />
          In stock only
        </label>
      </Group>
    </div>
  );
}

const FILTER_KEYS = ['brand', 'color', 'size', 'minPrice', 'maxPrice', 'rating', 'minDiscount', 'inStock'];

export function ActiveFilters() {
  const { params, update } = useParamUpdater();
  const chips: { key: string; value: string; label: string }[] = [];
  for (const k of ['brand', 'color', 'size']) for (const v of (params.get(k) ?? '').split(',').filter(Boolean)) chips.push({ key: k, value: v, label: v });
  if (params.get('minPrice') || params.get('maxPrice')) chips.push({ key: 'price', value: '', label: `₹${params.get('minPrice') ?? 0} – ${params.get('maxPrice') ? `₹${params.get('maxPrice')}` : 'max'}` });
  if (params.get('rating')) chips.push({ key: 'rating', value: '', label: `${params.get('rating')}★ & above` });
  if (params.get('minDiscount')) chips.push({ key: 'minDiscount', value: '', label: `${params.get('minDiscount')}%+ off` });
  if (params.get('inStock')) chips.push({ key: 'inStock', value: '', label: 'In stock' });
  if (!chips.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key + c.value}
          onClick={() =>
            c.key === 'price'
              ? update({ minPrice: null, maxPrice: null })
              : ['brand', 'color', 'size'].includes(c.key)
                ? update({ [c.key]: toggleCsv(params.get(c.key), c.value) })
                : update({ [c.key]: null })
          }
          className="flex items-center gap-1.5 rounded-full bg-plum-50 px-3 py-1.5 text-xs font-medium text-plum-700 hover:bg-plum-100"
        >
          {c.label} <X className="h-3 w-3" />
        </button>
      ))}
      <button onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))} className="text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink">
        Clear all
      </button>
    </div>
  );
}

export function SortSelect() {
  const { params, update } = useParamUpdater();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-muted sm:inline">Sort by</span>
      <select value={params.get('sort') ?? 'relevance'} onChange={(e) => update({ sort: e.target.value === 'relevance' ? null : e.target.value })} className="h-10 rounded-full border border-line bg-white pl-4 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-plum-100">
        <option value="relevance">Recommended</option>
        <option value="popular">Popularity</option>
        <option value="newest">Newest first</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="rating">Customer rating</option>
        <option value="discount">Better discount</option>
      </select>
    </label>
  );
}

export function FilterPanel(props: { facets: Facets; subcategories?: Subcategory[]; categorySlug?: string }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;
  useEffect(() => setOpen(false), [params]);
  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-36">
          <FilterBody {...props} />
        </div>
      </aside>
      <button onClick={() => setOpen(true)} className="flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium lg:hidden">
        <SlidersHorizontal className="h-4 w-4" /> Filters {activeCount > 0 && <span className="rounded-full bg-plum-700 px-1.5 text-[10px] text-white">{activeCount}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-plum-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-6 pb-24">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold">Filters</h2>
              <button onClick={() => setOpen(false)} aria-label="Close filters" className="p-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FilterBody {...props} />
          </div>
        </div>
      )}
    </>
  );
}
