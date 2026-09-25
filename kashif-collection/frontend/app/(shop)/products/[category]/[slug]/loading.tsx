import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="container grid gap-10 py-10 lg:grid-cols-[1.1fr_1fr]">
      <Skeleton className="aspect-square w-full rounded-3xl" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}
