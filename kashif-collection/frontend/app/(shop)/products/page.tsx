import type { Metadata } from 'next';
import { ProductListing, type SearchParams } from '@/components/listing/ProductListing';

export const metadata: Metadata = {
  title: 'Shop All Products',
  description: 'Browse cosmetics, laces and artificial jewellery from Kashif Collection. Filter by price, colour, rating and more.',
  alternates: { canonical: '/products' },
};

function heading(sp: SearchParams) {
  if (sp.newArrival === 'true') return 'New Arrivals';
  if (sp.bestSeller === 'true') return 'Best Sellers';
  if (sp.minDiscount) return 'Offers & Deals';
  return 'All Products';
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  return <ProductListing title={heading(sp)} description="Handpicked beauty, lace and jewellery — genuine products, fair prices." crumbs={[{ label: heading(sp) }]} basePath="/products" searchParams={sp} />;
}
