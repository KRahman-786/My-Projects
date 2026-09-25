import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileNav } from '@/components/layout/MobileNav';
import { catalog } from '@/services/catalog';
import type { Category } from '@/types';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // Navigation should never take the whole page down if the API is briefly unavailable.
  const categories: Category[] = await catalog.categories().catch(() => []);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Header categories={categories} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer categories={categories} />
      <MobileNav />
    </>
  );
}
