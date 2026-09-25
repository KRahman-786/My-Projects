import type { Metadata } from 'next';
import { StaticPage } from '@/components/layout/StaticPage';

export const metadata: Metadata = { title: 'Shipping Policy', alternates: { canonical: '/shipping-policy' } };

export default function ShippingPage() {
  return (
    <StaticPage title="Shipping Policy" updated="September 2026" intro="We ship across India from our store in Shahjahanpur, Uttar Pradesh.">
      <h2>Shipping charges</h2>
      <ul>
        <li>Flat ₹79 per order.</li>
        <li>
          <b>FREE shipping</b> on orders of ₹999 and above (after discounts).
        </li>
        <li>Cash on Delivery orders carry a ₹49 handling fee.</li>
      </ul>
      <h2>Delivery timelines</h2>
      <table>
        <thead>
          <tr>
            <th>Destination</th>
            <th>Estimated delivery</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Shahjahanpur city</td>
            <td>1–2 business days</td>
          </tr>
          <tr>
            <td>Uttar Pradesh &amp; Uttarakhand</td>
            <td>3–4 business days</td>
          </tr>
          <tr>
            <td>Delhi NCR, Punjab, Haryana</td>
            <td>4–5 business days</td>
          </tr>
          <tr>
            <td>Rest of India</td>
            <td>5–7 business days</td>
          </tr>
          <tr>
            <td>North-East, J&amp;K, islands</td>
            <td>7–10 business days</td>
          </tr>
        </tbody>
      </table>
      <p>Exact estimates for your pincode are shown on each product page and at checkout. Orders are dispatched within 24 hours on business days.</p>
      <h2>Tracking</h2>
      <p>Once shipped, you will receive a tracking number by email and in your account under “My Orders”.</p>
      <h2>Serviceability</h2>
      <p>A few remote pincodes may be unserviceable or prepaid-only; this is checked automatically at checkout.</p>
    </StaticPage>
  );
}
