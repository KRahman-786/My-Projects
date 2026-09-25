import type { ProductCard as TProduct } from '@/types';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products, priorityCount = 4 }: { products: TProduct[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
