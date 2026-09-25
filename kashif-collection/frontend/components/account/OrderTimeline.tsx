import { Check } from 'lucide-react';
import clsx from 'clsx';
import type { Order } from '@/types';
import { formatDateTime, ORDER_STATUS_LABEL } from '@/utils/format';

const FLOW = ['PLACED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

export function OrderTimeline({ order }: { order: Order }) {
  if (['CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'].includes(order.status) || order.status === 'PENDING') {
    return (
      <ol className="space-y-4">
        {order.statusHistory.map((h, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-plum-600" />
            <div className="text-sm">
              <p className="font-medium">{ORDER_STATUS_LABEL[h.toStatus]}</p>
              {h.note && <p className="text-ink-muted">{h.note}</p>}
              <p className="text-xs text-ink-muted">{formatDateTime(h.createdAt)}</p>
            </div>
          </li>
        ))}
      </ol>
    );
  }
  const reachedAt = (s: (typeof FLOW)[number]) => {
    if (s === 'PLACED') return order.placedAt;
    if (s === 'CONFIRMED') return order.statusHistory.find((h) => h.toStatus === 'CONFIRMED' || h.toStatus === 'PAID')?.createdAt;
    return order.statusHistory.find((h) => h.toStatus === s)?.createdAt;
  };
  const currentIdx = FLOW.findIndex((s) => s === (order.status === 'PAID' ? 'CONFIRMED' : order.status));
  return (
    <ol className="relative grid gap-5 md:grid-cols-7 md:gap-2">
      {FLOW.map((s, i) => {
        const done = i <= currentIdx;
        const at = reachedAt(s);
        return (
          <li key={s} className="relative flex gap-3 md:flex-col md:items-center md:text-center">
            {i < FLOW.length - 1 && <span className={clsx('absolute left-[13px] top-7 h-[calc(100%+4px)] w-0.5 md:left-[calc(50%+14px)] md:top-[13px] md:h-0.5 md:w-[calc(100%-20px)]', i < currentIdx ? 'bg-plum-600' : 'bg-line')} />}
            <span className={clsx('relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2', done ? 'border-plum-600 bg-plum-600 text-white' : 'border-line bg-white')}>
              {done && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="text-xs">
              <span className={clsx('block font-semibold', done ? 'text-ink' : 'text-ink-muted')}>{s === 'PLACED' ? 'Order placed' : ORDER_STATUS_LABEL[s]}</span>
              {at && done && <span className="block text-[11px] text-ink-muted">{formatDateTime(at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
