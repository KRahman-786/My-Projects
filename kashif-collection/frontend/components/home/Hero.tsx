import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blush via-ivory to-gold-50">
      <div aria-hidden className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-plum-100/60 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 left-1/3 h-[360px] w-[360px] rounded-full bg-gold-100/70 blur-3xl" />
      <div className="container relative grid items-center gap-10 py-12 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold-300/60 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-700">
            <Sparkles className="h-3.5 w-3.5" /> The Festive Edit is here
          </p>
          <h1 className="mt-6 font-display text-[44px] font-semibold leading-[1.02] text-ink sm:text-6xl lg:text-[76px]">
            Adorn every <span className="italic text-plum-700">moment</span>,<br className="hidden sm:block" /> the Kashif way.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-soft md:text-lg">
            Long-wear cosmetics, hand-finished gota &amp; zari laces and statement kundan jewellery — curated in Shahjahanpur, delivered to your doorstep.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products?sort=popular" className="inline-flex h-12 items-center gap-2 rounded-full bg-plum-700 px-8 text-sm font-semibold tracking-wide text-white shadow-lift transition hover:bg-plum-800">
              Shop the collection <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/category/artificial-jewellery" className="inline-flex h-12 items-center rounded-full border border-plum-700/30 bg-white/60 px-7 text-sm font-semibold text-plum-700 transition hover:border-plum-700">
              Bridal jewellery
            </Link>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              ['COD', 'Across India'],
              ['7-day', 'Easy returns'],
              ['GST', 'Invoice on every order'],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-2xl font-semibold text-plum-700 md:text-3xl">{v}</dd>
                <dd className="text-xs text-ink-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto grid w-full max-w-xl grid-cols-2 gap-3 md:gap-4">
          <Link href="/category/cosmetics" className="group relative row-span-2 overflow-hidden rounded-[28px] shadow-lift">
            <SmartImage src="/images/products/velvet-matte-lipstick-1.svg" alt="Velvet matte lipsticks" fill priority sizes="(min-width:1024px) 280px, 45vw" className="object-cover transition duration-700 group-hover:scale-105" />
            <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-plum-700">Cosmetics</span>
          </Link>
          <Link href="/category/artificial-jewellery" className="group relative aspect-square overflow-hidden rounded-[28px] shadow-card">
            <SmartImage src="/images/products/kundan-chandbali-earrings-1.svg" alt="Kundan chandbali earrings" fill priority sizes="(min-width:1024px) 280px, 45vw" className="object-cover transition duration-700 group-hover:scale-105" />
            <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-plum-700">Jewellery</span>
          </Link>
          <Link href="/category/lace" className="group relative aspect-square overflow-hidden rounded-[28px] shadow-card">
            <SmartImage src="/images/products/golden-gota-patti-border-lace-1.svg" alt="Gota patti lace" fill sizes="(min-width:1024px) 280px, 45vw" className="object-cover transition duration-700 group-hover:scale-105" />
            <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-plum-700">Lace</span>
          </Link>
          <div className="absolute -bottom-5 -left-3 hidden rounded-2xl bg-white px-5 py-4 shadow-lift sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Use code</p>
            <p className="font-display text-2xl font-semibold text-plum-700">WELCOME10</p>
            <p className="text-xs text-ink-soft">10% off your first order</p>
          </div>
        </div>
      </div>
    </section>
  );
}
