import Link from 'next/link';
import { PageHeader } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/ProductForm';

export const metadata = { title: 'New product' };

export default function NewProductPage() {
  return (
    <>
      <Link href="/admin/products" className="text-sm text-ink-muted hover:text-plum-700">
        ← Products
      </Link>
      <PageHeader title="Add product" />
      <ProductForm />
    </>
  );
}
