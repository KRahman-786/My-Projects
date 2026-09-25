import { catalog } from '@/services/catalog';
import { Hero } from '@/components/home/Hero';
import { CategoryShowcase } from '@/components/home/CategoryShowcase';
import { CategorySpotlight } from '@/components/home/CategorySpotlight';
import { OfferStrip } from '@/components/home/OfferStrip';
import { Testimonials } from '@/components/home/Testimonials';
import { DeliveryInfo, TrustBadges } from '@/components/home/TrustBadges';
import { ProductRail } from '@/components/product/ProductRail';
import { ErrorState } from '@/components/ui/EmptyState';

export const revalidate = 60;

export default async function HomePage() {
  const data = await catalog.home().catch(() => null);
  if (!data) {
    return (
      <>
        <Hero />
        <div className="container py-16">
          <ErrorState message="Our catalogue is taking a moment to load. Please refresh in a few seconds." />
        </div>
      </>
    );
  }
  return (
    <>
      <Hero />
      <TrustBadges />
      <CategoryShowcase categories={data.categories} />
      <ProductRail eyebrow="Most loved" title="Best Sellers" href="/products?bestSeller=true&sort=popular" products={data.bestSellers} />
      <CategorySpotlight
        eyebrow="Cosmetics"
        title="Colour that lasts all day"
        copy="Matte lipsticks, smudge-proof kajal and Ayurvedic skincare — tested on Indian skin tones."
        href="/category/cosmetics"
        image="/images/categories/cosmetics.svg"
        products={data.cosmetics}
      />
      <OfferStrip coupons={data.coupons} />
      <CategorySpotlight
        eyebrow="Lace"
        title="Borders that make the outfit"
        copy="Gota patti, zari cutwork, pearl drops and cotton crochet — by the metre, for every tailor's table."
        href="/category/lace"
        image="/images/categories/lace.svg"
        products={data.lace}
        reverse
        tone="sand"
      />
      <ProductRail eyebrow="Just landed" title="New Arrivals" href="/products?newArrival=true&sort=newest" products={data.newArrivals} />
      <CategorySpotlight
        eyebrow="Artificial Jewellery"
        title="Heirloom looks, everyday prices"
        copy="Kundan chandbalis, temple necklaces and AD sparkle — skin-friendly and gift-ready."
        href="/category/artificial-jewellery"
        image="/images/categories/artificial-jewellery.svg"
        products={data.jewellery}
        tone="plum"
      />
      <ProductRail eyebrow="Handpicked" title="Deals you'll love" href="/products?minDiscount=25&sort=discount" products={data.offers} />
      <Testimonials reviews={data.reviews} />
      <DeliveryInfo />
    </>
  );
}
