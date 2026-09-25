import { ProductGridSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="container py-10">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-10 w-72" />
      <div className="mt-10">
        <ProductGridSkeleton />
      </div>
    </div>
  );
}
