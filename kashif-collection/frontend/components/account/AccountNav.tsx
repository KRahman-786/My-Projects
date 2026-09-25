'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Package, MapPin, Heart, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/components/providers/AuthProvider';

const links = [
  { href: '/account', label: 'Profile', icon: User },
  { href: '/account/orders', label: 'My Orders', icon: Package },
  { href: '/account/addresses', label: 'Saved Addresses', icon: MapPin },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
];

export function AccountNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  return (
    <aside className="lg:w-64 lg:shrink-0">
      <div className="card p-5">
        <p className="text-xs text-ink-muted">Hello,</p>
        <p className="font-display text-2xl font-semibold">{user?.name ?? '…'}</p>
      </div>
      <nav className="no-scrollbar mt-4 flex gap-2 overflow-x-auto lg:flex-col lg:gap-1" aria-label="Account">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === '/account' ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={clsx('flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm transition lg:rounded-xl', active ? 'bg-plum-700 text-white' : 'bg-white text-ink-soft hover:bg-sand lg:bg-transparent')}>
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
        <button onClick={() => void logout().then(() => (window.location.href = '/'))} className="flex shrink-0 items-center gap-3 rounded-full bg-white px-4 py-2.5 text-sm text-ink-soft hover:bg-sand lg:rounded-xl lg:bg-transparent">
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </nav>
    </aside>
  );
}
