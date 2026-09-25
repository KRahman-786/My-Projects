import type { Metadata } from 'next';
import { AccountNav } from '@/components/account/AccountNav';

export const metadata: Metadata = { title: 'My Account', robots: { index: false } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container py-8 md:py-12">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <AccountNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
