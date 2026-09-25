'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { LayoutDashboard, ShoppingCart, Package, FolderTree, Boxes, Users, TicketPercent, Star, RotateCcw, Settings, Mail, Menu, X, Store, Bell, LogOut } from 'lucide-react';
import type { User } from '@/types';
import { admin } from '@/services/admin';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDateTime } from '@/utils/format';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin/customers', label: 'Customers', icon: Users },
  { href: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/returns', label: 'Returns & Refunds', icon: RotateCcw },
  { href: '/admin/messages', label: 'Messages', icon: Mail },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const { logout } = useAuth();
  const notes = useQuery({ queryKey: ['admin-notifications'], queryFn: admin.notifications, refetchInterval: 60_000 });
  const unread = notes.data?.filter((n) => !n.isRead).length ?? 0;
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="space-y-0.5 p-3" aria-label="Admin">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition', active ? 'bg-white/10 font-semibold text-white' : 'text-plum-200 hover:bg-white/5 hover:text-white')}>
            <Icon className="h-4 w-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F7F4F1]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-plum-900 lg:flex">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="font-display text-2xl font-semibold text-white">
            Kashif <span className="italic text-gold-300">Admin</span>
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <Link href="/" className="m-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-plum-200 hover:bg-white/5">
          <Store className="h-4 w-4" /> View storefront
        </Link>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-plum-900">
            <div className="flex items-center justify-between px-5 py-4">
              <p className="font-display text-xl text-white">Kashif Admin</p>
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur md:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setBell((v) => !v)} className="relative rounded-full p-2 hover:bg-sand" aria-label={`Notifications (${unread} unread)`}>
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />}
              </button>
              {bell && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <p className="text-sm font-semibold">Notifications</p>
                    {unread > 0 && (
                      <button onClick={() => void admin.readNotifications().then(() => notes.refetch())} className="text-xs font-semibold text-plum-700">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                    {notes.data?.length ? (
                      notes.data.map((n) => (
                        <li key={n.id}>
                          <Link href={n.link ?? '#'} onClick={() => setBell(false)} className={clsx('block px-4 py-3 text-sm hover:bg-ivory', !n.isRead && 'bg-plum-50/50')}>
                            <p className="font-medium">{n.title}</p>
                            <p className="text-xs text-ink-soft">{n.message}</p>
                            <p className="mt-0.5 text-[11px] text-ink-muted">{formatDateTime(n.createdAt)}</p>
                          </Link>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-6 text-center text-sm text-ink-muted">No notifications</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <span className="hidden text-sm text-ink-soft sm:inline">{user.name}</span>
            <button onClick={() => void logout().then(() => (window.location.href = '/login'))} className="rounded-full p-2 text-ink-muted hover:bg-sand" aria-label="Log out">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
