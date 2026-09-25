import { Truck, ShieldCheck, RotateCcw, BadgeIndianRupee, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';
import { SITE } from '@/lib/site';

const badges = [
  { icon: Truck, title: 'Free shipping', copy: 'On all orders above ₹999' },
  { icon: BadgeIndianRupee, title: 'Cash on Delivery', copy: 'Pay when your order arrives' },
  { icon: ShieldCheck, title: '100% secure payments', copy: 'UPI, cards & net banking' },
  { icon: RotateCcw, title: 'Easy 7-day returns', copy: 'Hassle-free refunds' },
];

export function TrustBadges() {
  return (
    <section className="border-y border-line bg-white">
      <div className="container grid grid-cols-2 gap-y-6 py-8 md:grid-cols-4">
        {badges.map(({ icon: Icon, title, copy }) => (
          <div key={title} className="flex flex-col items-center gap-2 px-2 text-center md:flex-row md:text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blush text-plum-700">
              <Icon className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">{title}</span>
              <span className="block text-xs text-ink-muted">{copy}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DeliveryInfo() {
  return (
    <section className="container py-14 md:py-20">
      <div className="grid overflow-hidden rounded-[28px] bg-gradient-to-br from-gold-50 to-blush md:grid-cols-2">
        <div className="p-8 md:p-12">
          <p className="eyebrow">Delivery across India</p>
          <h2 className="section-title mt-2">From Shahjahanpur to your doorstep</h2>
          <ul className="mt-6 space-y-4 text-sm text-ink-soft">
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-plum-600" />
              <span>
                <b className="text-ink">Shahjahanpur:</b> next-day delivery · <b className="text-ink">Uttar Pradesh:</b> 3–4 days · <b className="text-ink">Rest of India:</b> 5–7 days
              </span>
            </li>
            <li className="flex gap-3">
              <Truck className="mt-0.5 h-5 w-5 shrink-0 text-plum-600" />
              <span>Flat ₹79 shipping, free above ₹999. Check your pincode on any product page.</span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-plum-600" />
              <span>Every order is quality-checked and gift-packed at our store.</span>
            </li>
          </ul>
          <Link href="/shipping-policy" className="mt-7 inline-block text-sm font-semibold text-plum-700 underline-offset-4 hover:underline">
            Read our shipping policy →
          </Link>
        </div>
        <div className="flex flex-col justify-center gap-4 bg-plum-800 p-8 text-plum-100 md:p-12">
          <MapPin className="h-8 w-8 text-gold-300" />
          <p className="font-display text-3xl font-semibold text-white">Visit our store</p>
          <p className="text-sm leading-relaxed">
            {SITE.address.street}
            <br />
            {SITE.address.city}, {SITE.address.state} {SITE.address.pincode}
          </p>
          <p className="text-sm">{SITE.hours}</p>
          <a href={`https://wa.me/${SITE.whatsapp}`} className="mt-2 inline-flex h-11 w-fit items-center rounded-full bg-gold-400 px-6 text-sm font-semibold text-plum-900 hover:bg-gold-300">
            Chat on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
