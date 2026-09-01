import type { MetadataRoute } from 'next';
import { brand, getSiteOrigin } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/en/dashboard', '/ru/dashboard'],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: brand.productionOrigin,
  };
}
