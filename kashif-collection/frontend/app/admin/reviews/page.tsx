'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, EyeOff, Trash2 } from 'lucide-react';
import { admin } from '@/services/admin';
import { FilterSelect, PageHeader, Pager, Panel } from '@/components/admin/ui';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Stars } from '@/components/ui/Stars';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/providers/ToastProvider';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/utils/format';

export default function ReviewsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['admin-reviews', status, page], queryFn: () => admin.reviews({ status: status || undefined, page, limit: 20 }), placeholderData: (p) => p });
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      void qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  return (
    <>
      <PageHeader title="Reviews" description="Verified-purchase reviews publish automatically; others wait here for approval." />
      <div className="mb-4">
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[['PENDING', 'Pending'], ['APPROVED', 'Approved'], ['HIDDEN', 'Hidden'], ['', 'All']]} />
      </div>
      <Panel>
        {list.isLoading ? (
          <Spinner />
        ) : list.data?.data.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">No reviews here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.data?.data.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-5 md:flex-row">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    {r.isVerifiedPurchase && (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    )}
                  </div>
                  {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                  <p className="mt-1 text-sm text-ink-soft">{r.body}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.imageUrl && <img src={r.imageUrl} alt="Review attachment" className="mt-2 h-20 w-20 rounded-lg object-cover" />}
                  <p className="mt-2 text-xs text-ink-muted">
                    {r.user.name} ({r.user.email}) on <b>{r.product.name}</b> · {formatDateTime(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 md:flex-col">
                  {r.status !== 'APPROVED' && (
                    <button onClick={() => void act(() => admin.setReviewStatus(r.id, 'APPROVED'), 'Review approved')} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-success">
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {r.status !== 'HIDDEN' && (
                    <button onClick={() => void act(() => admin.setReviewStatus(r.id, 'HIDDEN'), 'Review hidden')} className="flex items-center gap-1.5 rounded-lg bg-sand px-3 py-1.5 text-xs font-semibold text-ink-soft">
                      <EyeOff className="h-3.5 w-3.5" /> Hide
                    </button>
                  )}
                  <button onClick={() => confirm('Delete this review permanently?') && void act(() => admin.deleteReview(r.id), 'Review deleted')} className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-danger">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager meta={list.data?.meta} onPage={setPage} />
      </Panel>
    </>
  );
}
