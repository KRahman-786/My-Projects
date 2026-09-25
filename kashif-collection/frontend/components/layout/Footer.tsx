import Link from 'next/link';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

const SOCIAL = [
  { label: 'Instagram', d: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4ZM12 2.8c2.5 0 2.8 0 3.8.1 2.5.1 3.7 1.3 3.8 3.8.1 1 .1 1.3.1 3.8s0 2.8-.1 3.8c-.1 2.5-1.3 3.7-3.8 3.8-1 .1-1.3.1-3.8.1s-2.8 0-3.8-.1c-2.5-.1-3.7-1.3-3.8-3.8-.1-1-.1-1.3-.1-3.8s0-2.8.1-3.8C4.5 4.2 5.7 3 8.2 2.9c1-.1 1.3-.1 3.8-.1Z' },
  { label: 'Facebook', d: 'M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8.1v3h2.5V21h2.9Z' },
  { label: 'YouTube', d: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z' },
];
import type { Category } from '@/types';
import { SITE } from '@/lib/site';

export function Footer({ categories }: { categories: Category[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 bg-plum-900 pb-20 text-plum-100 md:pb-0">
      <div className="container grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <p className="font-display text-3xl font-semibold text-white">
            Kashif <span className="italic text-gold-300">Collection</span>
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-plum-200">
            Cosmetics, designer laces and artificial jewellery from Shahjahanpur — delivered across India.
          </p>
          <div className="mt-6 flex gap-3">
            {SOCIAL.map((s) => (
              <a key={s.label} href="#" aria-label={s.label} className="flex h-9 w-9 items-center justify-center rounded-full border border-plum-600 text-plum-200 transition hover:border-gold-300 hover:text-gold-300">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d={s.d} />
                </svg>
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Shop</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/products?newArrival=true&sort=newest" className="hover:text-white">
                New Arrivals
              </Link>
            </li>
            <li>
              <Link href="/products?bestSeller=true" className="hover:text-white">
                Best Sellers
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Help</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              ['Track Order', '/account/orders'],
              ['Shipping Policy', '/shipping-policy'],
              ['Return & Refund', '/return-policy'],
              ['Cancellation Policy', '/cancellation-policy'],
              ['FAQ', '/faq'],
              ['Contact Us', '/contact'],
            ].map(([label, href]) => (
              <li key={href}>
                <Link href={href!} className="hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Visit our store</h3>
          <ul className="mt-4 space-y-3 text-sm text-plum-200">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
              <span>
                {SITE.address.street},<br />
                {SITE.address.city}, {SITE.address.state} {SITE.address.pincode}
              </span>
            </li>
            <li className="flex gap-3">
              <Phone className="h-4 w-4 shrink-0 text-gold-300" />
              <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="hover:text-white">
                {SITE.phone}
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="h-4 w-4 shrink-0 text-gold-300" />
              <a href={`mailto:${SITE.email}`} className="hover:text-white">
                {SITE.email}
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="h-4 w-4 shrink-0 text-gold-300" />
              {SITE.hours}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-plum-800">
        <div className="container flex flex-col items-center justify-between gap-4 py-6 text-xs text-plum-300 md:flex-row">
          <p>© {year} Kashif Collection. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['UPI', 'Visa', 'Mastercard', 'RuPay', 'Net Banking', 'COD'].map((m) => (
              <span key={m} className="rounded border border-plum-700 px-2 py-1 text-[10px] font-semibold tracking-wide text-plum-200">
                {m}
              </span>
            ))}
          </div>
          <div className="flex gap-4">
            <Link href="/privacy-policy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/about" className="hover:text-white">
              About
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
