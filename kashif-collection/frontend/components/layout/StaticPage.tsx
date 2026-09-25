import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export function StaticPage({ title, intro, updated, children }: { title: string; intro?: string; updated?: string; children: ReactNode }) {
  return (
    <div className="container py-8 md:py-12">
      <Breadcrumbs items={[{ label: title }]} />
      <header className="mx-auto mt-6 max-w-3xl text-center">
        <p className="eyebrow">Kashif Collection</p>
        <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">{title}</h1>
        {intro && <p className="mt-4 text-ink-soft">{intro}</p>}
        {updated && <p className="mt-2 text-xs text-ink-muted">Last updated: {updated}</p>}
      </header>
      <article className="prose-kc card mx-auto mt-10 max-w-3xl p-6 md:p-10">{children}</article>
    </div>
  );
}
