'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Menu, ShoppingBag, User, X, ChevronDown, LogOut, Package, MapPin, LayoutDashboard, Search } from 'lucide-react';
import clsx from 'clsx';
import type { Category } from '@/types';
import { Logo } from './Logo';
import { SearchBox } from './SearchBox';
import { useCart } from '@/components/providers/CartProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWishlist } from '@/components/providers/WishlistProvider';

function CountBadge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-plum-700 px-1 text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</span>;
}

export function Header({ categories }: { categories: Category[] }) {
  const [drawer, setDrawer] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const pathname = usePathname();
  const { count } = useCart();
  const { user, logout } = useAuth();
  const { ids } = useWishlist();

  useEffect(() => {
    setDrawer(false);
    setAccountOpen(false);
    setMobileSearch(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
  }, [drawer]);

  return (
    <>
      <div className="bg-plum-800 text-center text-[11px] font-medium tracking-wide text-gold-100 sm:text-xs">
        <div className="container flex h-9 items-center justify-center gap-6 overflow-hidden whitespace-nowrap">
          <span>✦ Free shipping on orders above ₹999</span>
          <span className="hidden sm:inline">✦ Cash on Delivery available</span>
          <span className="hidden md:inline">✦ Easy 7-day returns</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container flex h-16 items-center gap-3 md:h-20 md:gap-6">
          <button className="-ml-2 p-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu className="h-6 w-6 text-ink" />
          </button>
          <Logo />
          <SearchBox className="ml-4 hidden max-w-xl flex-1 md:block" />
          <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Account">
            <button className="p-2 md:hidden" onClick={() => setMobileSearch((v) => !v)} aria-label="Search">
              <Search className="h-[22px] w-[22px]" />
            </button>
            <div className="relative hidden sm:block">
              {user ? (
                <button onClick={() => setAccountOpen((v) => !v)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm hover:bg-ivory" aria-expanded={accountOpen}>
                  <User className="h-5 w-5" />
                  <span className="hidden max-w-[110px] truncate lg:inline">{user.name.split(' ')[0]}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Link href="/login" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm hover:bg-ivory">
                  <User className="h-5 w-5" />
                  <span className="hidden lg:inline">Login</span>
                </Link>
              )}
              {accountOpen && user && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white py-2 shadow-lift" onMouseLeave={() => setAccountOpen(false)}>
                  <p className="px-4 pb-2 pt-1 text-xs text-ink-muted">
                    Signed in as <span className="block truncate font-medium text-ink">{user.email}</span>
                  </p>
                  {user.role === 'ADMIN' && (
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-2 text-sm text-plum-700 hover:bg-ivory">
                      <LayoutDashboard className="h-4 w-4" /> Admin dashboard
                    </Link>
                  )}
                  <Link href="/account" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-ivory">
                    <User className="h-4 w-4" /> My account
                  </Link>
                  <Link href="/account/orders" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-ivory">
                    <Package className="h-4 w-4" /> My orders
                  </Link>
                  <Link href="/account/addresses" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-ivory">
                    <MapPin className="h-4 w-4" /> Addresses
                  </Link>
                  <button onClick={() => void logout()} className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-sm text-ink-soft hover:bg-ivory">
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </div>
              )}
            </div>
            <Link href="/wishlist" className="relative hidden p-2 sm:block" aria-label={`Wishlist (${ids.size})`}>
              <Heart className="h-[22px] w-[22px]" />
              <CountBadge n={ids.size} />
            </Link>
            <Link href="/cart" className="relative p-2" aria-label={`Shopping bag (${count} items)`}>
              <ShoppingBag className="h-[22px] w-[22px]" />
              <CountBadge n={count} />
            </Link>
          </nav>
        </div>

        {mobileSearch && (
          <div className="container pb-3 md:hidden">
            <SearchBox autoFocus onNavigate={() => setMobileSearch(false)} />
          </div>
        )}

        <nav className="hidden border-t border-line/70 lg:block" aria-label="Main">
          <ul className="container flex h-12 items-center justify-center gap-9 text-[13px] font-medium uppercase tracking-[0.14em] text-ink-soft">
            <li>
              <Link href="/products?newArrival=true&sort=newest" className="hover:text-plum-700">
                New Arrivals
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id} className="group relative">
                <Link href={`/category/${c.slug}`} className={clsx('flex h-12 items-center gap-1 hover:text-plum-700', pathname.startsWith(`/category/${c.slug}`) && 'text-plum-700')}>
                  {c.name} <ChevronDown className="h-3 w-3 transition group-hover:rotate-180" />
                </Link>
                {c.subcategories.length > 0 && (
                  <div className="invisible absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 translate-y-1 rounded-2xl border border-line bg-white p-3 opacity-0 shadow-lift transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <Link href={`/category/${c.slug}`} className="block rounded-lg px-3 py-2 text-xs font-semibold normal-case tracking-normal text-plum-700 hover:bg-ivory">
                      Shop all {c.name}
                    </Link>
                    {c.subcategories.map((s) => (
                      <Link key={s.id} href={`/category/${c.slug}/${s.slug}`} className="block rounded-lg px-3 py-2 text-sm normal-case tracking-normal text-ink-soft hover:bg-ivory hover:text-plum-700">
                        {s.name}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
            <li>
              <Link href="/products?bestSeller=true&sort=popular" className="hover:text-plum-700">
                Best Sellers
              </Link>
            </li>
            <li>
              <Link href="/products?minDiscount=30&sort=discount" className="text-plum-600 hover:text-plum-800">
                Offers
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      {/* Mobile drawer */}
      <div className={clsx('fixed inset-0 z-[60] lg:hidden', drawer ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!drawer}>
        <div className={clsx('absolute inset-0 bg-plum-900/40 transition-opacity', drawer ? 'opacity-100' : 'opacity-0')} onClick={() => setDrawer(false)} />
        <aside className={clsx('absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-lift transition-transform duration-300', drawer ? 'translate-x-0' : '-translate-x-full')}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <Logo />
            <button onClick={() => setDrawer(false)} aria-label="Close menu" className="p-2">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {user ? (
              <p className="mb-4 rounded-xl bg-ivory px-4 py-3 text-sm">
                Hello, <span className="font-semibold">{user.name.split(' ')[0]}</span>
              </p>
            ) : (
              <Link href="/login" className="mb-4 block rounded-xl bg-plum-700 px-4 py-3 text-center text-sm font-semibold text-white">
                Login / Register
              </Link>
            )}
            <ul className="space-y-1">
              <li>
                <Link href="/products?newArrival=true&sort=newest" className="block py-2.5 font-medium">
                  New Arrivals
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-2.5 font-medium">
                      {c.name}
                      <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                    </summary>
                    <ul className="mb-2 ml-3 border-l border-line pl-4">
                      <li>
                        <Link href={`/category/${c.slug}`} className="block py-2 text-sm font-semibold text-plum-700">
                          Shop all
                        </Link>
                      </li>
                      {c.subcategories.map((s) => (
                        <li key={s.id}>
                          <Link href={`/category/${c.slug}/${s.slug}`} className="block py-2 text-sm text-ink-soft">
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
              <li>
                <Link href="/products?bestSeller=true&sort=popular" className="block py-2.5 font-medium">
                  Best Sellers
                </Link>
              </li>
              <li>
                <Link href="/products?minDiscount=30&sort=discount" className="block py-2.5 font-medium text-plum-600">
                  Offers
                </Link>
              </li>
            </ul>
            <div className="mt-6 space-y-1 border-t border-line pt-4 text-sm text-ink-soft">
              {user && (
                <>
                  {user.role === 'ADMIN' && (
                    <Link href="/admin" className="block py-2 font-medium text-plum-700">
                      Admin dashboard
                    </Link>
                  )}
                  <Link href="/account/orders" className="block py-2">
                    My Orders
                  </Link>
                  <Link href="/account" className="block py-2">
                    My Account
                  </Link>
                </>
              )}
              <Link href="/wishlist" className="block py-2">
                Wishlist
              </Link>
              <Link href="/contact" className="block py-2">
                Contact Us
              </Link>
              <Link href="/faq" className="block py-2">
                FAQ
              </Link>
              {user && (
                <button onClick={() => void logout()} className="block py-2">
                  Log out
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
