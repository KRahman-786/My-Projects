import type { Metadata } from 'next';
import { StaticPage } from '@/components/layout/StaticPage';

export const metadata: Metadata = { title: 'Return & Refund Policy', alternates: { canonical: '/return-policy' } };

export default function ReturnPage() {
  return (
    <StaticPage title="Return & Refund Policy" updated="September 2026" intro="Not happy with your purchase? We make returns simple.">
      <h2>Return window</h2>
      <p>You can request a return within <b>7 days of delivery</b> from “My Orders” → select the order → “Return / refund”.</p>
      <h2>Eligible returns</h2>
      <ul>
        <li>Damaged, defective or wrong item received</li>
        <li>Product significantly different from its description</li>
        <li>Unused items with original tags and packaging</li>
      </ul>
      <h2>Non-returnable items</h2>
      <ul>
        <li>Opened or used cosmetics and skincare (for hygiene reasons), unless damaged or defective</li>
        <li>Lace that has been cut or stitched</li>
        <li>Earrings that have been worn (for hygiene reasons)</li>
      </ul>
      <h2>Refunds</h2>
      <ul>
        <li>Refunds are processed after the returned item passes a quality check.</li>
        <li>Prepaid orders are refunded to the original payment method; COD orders are refunded by bank transfer or UPI.</li>
        <li>Shipping and COD handling fees are non-refundable, except for damaged or wrong items.</li>
        <li>Refunds typically reflect in 5–7 business days after processing.</li>
      </ul>
    </StaticPage>
  );
}
