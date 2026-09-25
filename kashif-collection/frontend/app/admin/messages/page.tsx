'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { admin } from '@/services/admin';
import { PageHeader, Pager, Panel } from '@/components/admin/ui';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/format';

export default function MessagesPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['admin-messages', page], queryFn: () => admin.messages({ page }) });
  return (
    <>
      <PageHeader title="Contact messages" />
      <Panel>
        {q.isLoading ? (
          <Spinner />
        ) : !q.data?.data.length ? (
          <p className="py-12 text-center text-sm text-ink-muted">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {q.data.data.map((m) => (
              <li key={m.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {m.subject} {m.isHandled ? <Badge tone="green">Handled</Badge> : <Badge tone="amber">New</Badge>}
                  </p>
                  <span className="text-xs text-ink-muted">{formatDateTime(m.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {m.name} · <a href={`mailto:${m.email}`} className="text-plum-700">{m.email}</a> {m.phone && `· ${m.phone}`}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{m.message}</p>
                <button onClick={() => void admin.markMessage(m.id, !m.isHandled).then(() => q.refetch())} className="mt-3 text-xs font-semibold text-plum-700">
                  Mark as {m.isHandled ? 'new' : 'handled'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pager meta={q.data?.meta} onPage={setPage} />
      </Panel>
    </>
  );
}
