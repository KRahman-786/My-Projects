import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPage } from '@/components/layout/StaticPage';

export const metadata: Metadata = { title: 'Terms & Conditions', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <StaticPage title="Terms & Conditions" updated="September 2026">
      <p>By using this website and placing an order with Kashif Collection, you agree to the following terms.</p>
      <h2>Products &amp; pricing</h2>
      <ul>
        <li>All prices are in Indian Rupees (₹) and inclusive of GST unless stated otherwise.</li>
        <li>Product colours may vary slightly due to screen settings and photography.</li>
        <li>Prices, offers and availability may change without notice. The price payable is the one confirmed at checkout; if a price changes while you are checking out, we will ask you to review the new total before placing the order.</li>
      </ul>
      <h2>Orders</h2>
      <ul>
        <li>An order is confirmed once payment is verified (online) or once it is accepted as Cash on Delivery.</li>
        <li>Unpaid online orders are held for a limited time and cancelled automatically if payment is not completed.</li>
        <li>We may cancel orders in case of stock errors, pricing errors or suspected fraud, with a full refund of any amount paid.</li>
      </ul>
      <h2>Coupons</h2>
      <p>Coupons are subject to their stated conditions (minimum value, expiry, usage limits, eligible categories) and cannot be exchanged for cash.</p>
      <h2>Accounts</h2>
      <p>You are responsible for keeping your password confidential. We may suspend accounts involved in misuse, fraud or abuse of offers.</p>
      <h2>Returns, refunds &amp; cancellations</h2>
      <p>
        Please see our <Link href="/return-policy">Return &amp; Refund Policy</Link>, <Link href="/cancellation-policy">Cancellation Policy</Link> and <Link href="/shipping-policy">Shipping Policy</Link>.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Disputes are subject to the jurisdiction of courts in Shahjahanpur, Uttar Pradesh.</p>
    </StaticPage>
  );
}
