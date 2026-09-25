import type { Metadata } from 'next';
import { StaticPage } from '@/components/layout/StaticPage';

export const metadata: Metadata = { title: 'Cancellation Policy', alternates: { canonical: '/cancellation-policy' } };

export default function CancellationPage() {
  return (
    <StaticPage title="Cancellation Policy" updated="September 2026">
      <h2>Cancelling your order</h2>
      <p>You can cancel an order yourself from “My Orders” until it is <b>packed</b>. Once an order has been packed or shipped, please refuse delivery or request a return after delivery.</p>
      <h2>Refunds on cancellation</h2>
      <ul>
        <li>Prepaid orders: a full refund (including shipping) is initiated immediately to the original payment method.</li>
        <li>Cash on Delivery orders: no payment is collected, so nothing needs to be refunded.</li>
        <li>Any coupon used on a cancelled order is restored to your account.</li>
      </ul>
      <h2>Unpaid orders</h2>
      <p>If an online payment is not completed within 30 minutes, the order is cancelled automatically and the reserved items are released.</p>
      <h2>Cancellation by us</h2>
      <p>We may cancel an order due to stock unavailability, pricing errors or delivery restrictions. You will be notified and fully refunded.</p>
    </StaticPage>
  );
}
