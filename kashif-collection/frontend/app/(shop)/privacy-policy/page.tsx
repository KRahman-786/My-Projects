import type { Metadata } from 'next';
import { StaticPage } from '@/components/layout/StaticPage';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy Policy', alternates: { canonical: '/privacy-policy' } };

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy Policy" updated="September 2026" intro="Your privacy matters to us. This policy explains what we collect and how we use it.">
      <h2>Information we collect</h2>
      <ul>
        <li>Account details: name, email address, mobile number and a securely hashed password.</li>
        <li>Delivery addresses you save or use at checkout.</li>
        <li>Order history, reviews, wishlist and cart contents.</li>
        <li>Payment status and transaction references from our payment partners. We never see or store your full card number, CVV or UPI PIN.</li>
        <li>Basic technical data (IP address, browser) for security and fraud prevention.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To process, ship and support your orders.</li>
        <li>To send order updates and, only if you opt in, offers.</li>
        <li>To prevent fraud and keep your account secure.</li>
        <li>To comply with tax (GST) and legal obligations.</li>
      </ul>
      <h2>Sharing</h2>
      <p>We share only what is necessary with trusted partners: payment gateways (Razorpay, Stripe), courier partners for delivery, and image hosting. We never sell your data.</p>
      <h2>Cookies</h2>
      <p>We use a secure, HTTP-only session cookie to keep you signed in, and your browser&apos;s local storage to remember your guest bag and recently viewed products.</p>
      <h2>Your rights</h2>
      <p>You may view and update your profile and addresses from your account, or email {SITE.email} to request a copy or deletion of your data (subject to legal record-keeping requirements).</p>
      <h2>Contact</h2>
      <p>
        Grievance Officer, Kashif Collection, {SITE.address.street}, {SITE.address.city}, {SITE.address.state} {SITE.address.pincode}. Email: {SITE.email}
      </p>
    </StaticPage>
  );
}
