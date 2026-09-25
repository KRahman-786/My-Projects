import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPage } from '@/components/layout/StaticPage';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'About Us', description: 'The story of Kashif Collection — a family-run cosmetics, lace and artificial jewellery store near Eidgah, Kamran Market, Shahjahanpur.', alternates: { canonical: '/about' } };

export default function AboutPage() {
  return (
    <StaticPage title="About Us" intro="A family-run store from the heart of Shahjahanpur, now serving customers across India.">
      <h2>Who we are</h2>
      <p>
        Kashif Collection is a cosmetics, lace and artificial jewellery store located near Eidgah, Kamran Market in Shahjahanpur, Uttar Pradesh — the place
        to find the perfect lipstick shade, the right gota lace for a wedding lehenga, or a pair of jhumkas for Eid.
      </p>
      <p>With our online store, the same care goes into every order — each product is checked, carefully packed and shipped from our store.</p>
      <h2>What we sell</h2>
      <ul>
        <li>
          <b>Cosmetics</b> — lipsticks, kajal, face makeup, nail colours, skincare and fragrances suited to Indian skin tones.
        </li>
        <li>
          <b>Lace</b> — gota patti, zari, embroidered, crochet, beaded and net laces for tailors, boutiques and home stitching.
        </li>
        <li>
          <b>Artificial Jewellery</b> — kundan, polki, temple, oxidised and American diamond jewellery for every occasion.
        </li>
      </ul>
      <h2>Our promise</h2>
      <ul>
        <li>Genuine products, stored and handled with care</li>
        <li>Transparent pricing — MRP inclusive of GST, no hidden charges</li>
        <li>Cash on Delivery and secure online payments</li>
        <li>Easy returns and responsive customer support</li>
      </ul>
      <h2>Visit us</h2>
      <p>
        {SITE.address.street}, {SITE.address.city}, {SITE.address.state} {SITE.address.pincode}. Open {SITE.hours}. Have a question? <Link href="/contact">Get in touch</Link>.
      </p>
    </StaticPage>
  );
}
