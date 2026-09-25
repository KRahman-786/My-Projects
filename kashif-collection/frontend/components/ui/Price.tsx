import clsx from 'clsx';
import { formatPrice } from '@/utils/format';

export function Price({ price, mrp, size = 'md', className }: { price: number; mrp?: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const off = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <div className={clsx('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={clsx('font-semibold text-ink', size === 'lg' ? 'text-2xl md:text-3xl' : size === 'sm' ? 'text-sm' : 'text-base')}>{formatPrice(price)}</span>
      {off > 0 && (
        <>
          <span className={clsx('text-ink-muted line-through', size === 'lg' ? 'text-base' : 'text-xs')}>
            <span className="sr-only">MRP </span>
            {formatPrice(mrp!)}
          </span>
          <span className={clsx('font-semibold text-success', size === 'lg' ? 'text-base' : 'text-xs')}>{off}% off</span>
        </>
      )}
    </div>
  );
}
