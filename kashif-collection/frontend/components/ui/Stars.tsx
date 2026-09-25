import { Star } from 'lucide-react';
import clsx from 'clsx';

export function Stars({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-0.5', className)} aria-label={`Rated ${rating} out of 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-gold-200" style={{ width: size, height: size }} strokeWidth={1.5} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="fill-gold-400 text-gold-400" style={{ width: size, height: size }} strokeWidth={1.5} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function RatingPill({ rating, count }: { rating: number; count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-success px-1.5 py-0.5 text-[11px] font-semibold text-white">
      {rating.toFixed(1)} <Star className="h-3 w-3 fill-white" />
      <span className="font-normal opacity-90">({count})</span>
    </span>
  );
}
