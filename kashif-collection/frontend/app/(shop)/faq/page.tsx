import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export const metadata: Metadata = { title: 'Frequently Asked Questions', description: 'Answers about orders, delivery, COD, returns, payments and products at Kashif Collection.', alternates: { canonical: '/faq' } };

const FAQS: { q: string; a: string }[] = [
  { q: 'Is Cash on Delivery available?', a: 'Yes. COD is available on most pincodes across India for orders within our COD limits. A small handling fee of ₹49 applies. Availability for your pincode is shown at checkout.' },
  { q: 'How long does delivery take?', a: 'Shahjahanpur: 1–2 days. Uttar Pradesh: 3–4 days. Rest of India: 5–7 business days. You can check the exact estimate for your pincode on any product page.' },
  { q: 'Do you charge for shipping?', a: 'Shipping is a flat ₹79, and free on orders of ₹999 or more.' },
  { q: 'Are prices inclusive of GST?', a: 'Yes, all prices are inclusive of GST. The GST breakdown (CGST/SGST or IGST) is shown at checkout and on your invoice.' },
  { q: 'Which payment methods do you accept?', a: 'UPI, credit and debit cards, net banking and wallets through Razorpay, international cards through Stripe, and Cash on Delivery.' },
  { q: 'What if my payment fails?', a: 'If money was not deducted, simply retry from “My Orders” — your items stay reserved for 30 minutes. If money was deducted but the order shows pending, don’t worry: our system confirms payments automatically with the bank, or refunds them.' },
  { q: 'How do I return a product?', a: 'Go to My Orders → select the order → “Return / refund” within 7 days of delivery. Once we receive and check the item, your refund is processed.' },
  { q: 'Can I cancel my order?', a: 'Yes, until the order is packed. Prepaid orders are refunded in full to the original payment method.' },
  { q: 'Is the artificial jewellery skin-friendly?', a: 'Our jewellery is nickel-free wherever stated in the specifications. Keep it away from water and perfume to make the plating last longer.' },
  { q: 'Do you sell lace in bulk for boutiques?', a: 'Yes! Contact us with the design and quantity, and we will share wholesale pricing.' },
  { q: 'How do I download my invoice?', a: 'Open the order in “My Orders” and tap “Download invoice”. A GST invoice is available once the order is confirmed.' },
];

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return (
    <div className="container py-8 md:py-12">
      <Breadcrumbs items={[{ label: 'FAQ' }]} />
      <header className="mx-auto mt-6 max-w-2xl text-center">
        <p className="eyebrow">Help centre</p>
        <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">Frequently asked questions</h1>
      </header>
      <div className="mx-auto mt-10 max-w-3xl space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="card group p-5 open:shadow-lift">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {f.q}
              <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
