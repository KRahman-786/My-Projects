import type { Metadata } from 'next';
import { MapPin, Phone, Mail, Clock, MessageCircle } from 'lucide-react';
import { SITE } from '@/lib/site';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = { title: 'Contact Us', description: 'Get in touch with Kashif Collection, Shahjahanpur — phone, WhatsApp, email or visit our store near Eidgah, Kamran Market.', alternates: { canonical: '/contact' } };

export default function ContactPage() {
  const items = [
    { icon: MapPin, title: 'Store address', body: `${SITE.address.street}, ${SITE.address.city}, ${SITE.address.state} ${SITE.address.pincode}` },
    { icon: Phone, title: 'Phone', body: SITE.phone, href: `tel:${SITE.phone.replace(/\s/g, '')}` },
    { icon: MessageCircle, title: 'WhatsApp', body: 'Chat with us', href: `https://wa.me/${SITE.whatsapp}` },
    { icon: Mail, title: 'Email', body: SITE.email, href: `mailto:${SITE.email}` },
    { icon: Clock, title: 'Store hours', body: SITE.hours },
  ];
  return (
    <div className="container py-8 md:py-12">
      <Breadcrumbs items={[{ label: 'Contact Us' }]} />
      <header className="mt-6 max-w-2xl">
        <p className="eyebrow">We&apos;re here to help</p>
        <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">Contact us</h1>
        <p className="mt-3 text-ink-soft">Questions about an order, a product or bulk lace purchases for your boutique? We usually reply within a few hours.</p>
      </header>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <ul className="space-y-3">
          {items.map(({ icon: Icon, title, body, href }) => (
            <li key={title} className="card flex items-start gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blush text-plum-700">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                {href ? (
                  <a href={href} className="text-sm text-plum-700 hover:underline">
                    {body}
                  </a>
                ) : (
                  <p className="text-sm text-ink-soft">{body}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="card p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">Send us a message</h2>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
