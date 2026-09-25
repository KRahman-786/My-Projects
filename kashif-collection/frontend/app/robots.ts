import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/checkout', '/cart', '/api/', '/search'] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
