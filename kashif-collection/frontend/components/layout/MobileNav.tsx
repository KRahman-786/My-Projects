'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Heart, User, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';
import { useCart } from '@/components/providers/CartProvider';

const items = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/products', label: 'Shop', icon: LayoutGrid },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/cart', label: 'Bag', icon: ShoppingBag },
  { href: '/account', label: 'Account', icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const { count } = useCart();
  if (pathname.startsWith('/checkout') || pathname.startsWith('/admin')) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Quick navigation">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} className={clsx('relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', active ? 'text-plum-700' : 'text-ink-muted')}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.7} />
                {label}
                {href === '/cart' && count > 0 && <span className="absolute right-[26%] top-1 h-2 w-2 rounded-full bg-plum-600" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
