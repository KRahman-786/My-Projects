import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-blush">
        <Icon className="h-9 w-9 text-plum-600" strokeWidth={1.4} />
      </div>
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      {description && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-danger/20 bg-danger/5 px-6 py-8 text-center">
      <p className="font-medium text-danger">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-semibold text-plum-700 underline underline-offset-4">
          Try again
        </button>
      )}
    </div>
  );
}
