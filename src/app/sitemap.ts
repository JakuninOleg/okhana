import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/brand';
import { routing } from '@/i18n/routing';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    entries.push({
      url: absoluteUrl(`/${locale}`),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((loc) => [loc, absoluteUrl(`/${loc}`)]),
        ),
      },
    });
  }

  return entries;
}
