'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { admin } from '@/services/admin';
import { PageHeader } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/ProductForm';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/EmptyState';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({ queryKey: ['admin-product', id], queryFn: () => admin.product(id) });
  return (
    <>
      <Link href="/admin/products" className="text-sm text-ink-muted hover:text-plum-700">
        ← Products
      </Link>
      <PageHeader title={q.data?.name ?? 'Edit product'} />
      {q.isLoading ? <Spinner /> : q.isError || !q.data ? <ErrorState message="Product not found." /> : <ProductForm key={q.data.id + q.dataUpdatedAt} product={q.data} />}
    </>
  );
}
