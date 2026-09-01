import type { Metadata } from 'next';
import { brand, absoluteUrl, getSiteOrigin } from '@/lib/brand';
import { routing, type Locale } from '@/i18n/routing';

export type SeoCopy = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
};

export function buildLocaleMetadata(locale: Locale, copy: SeoCopy): Metadata {
  const path = `/${locale}`;
  const url = absoluteUrl(path);
  const ogImage = absoluteUrl(brand.ogImagePath);
  const keywords = [...brand.keywords[locale === 'en' ? 'en' : 'ru']];

  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    languages[loc] = absoluteUrl(`/${loc}`);
  }
  languages['x-default'] = absoluteUrl(`/${routing.defaultLocale}`);

  return {
    metadataBase: new URL(getSiteOrigin()),
    title: {
      default: copy.title,
      template: `%s · ${brand.name}`,
    },
    description: copy.description,
    applicationName: brand.name,
    authors: [{ name: brand.name, url: brand.productionOrigin }],
    creator: brand.name,
    publisher: brand.name,
    keywords,
    category: 'lifestyle',
    referrer: 'origin-when-cross-origin',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: brand.name,
    },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      shortcut: ['/favicon.ico'],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        { url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    alternates: {
      canonical: url,
      languages,
    },
    openGraph: {
      type: 'website',
      locale: locale === 'en' ? 'en_US' : 'ru_RU',
      alternateLocale: locale === 'en' ? ['ru_RU'] : ['en_US'],
      url,
      siteName: brand.siteName,
      title: copy.ogTitle,
      description: copy.ogDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${brand.name} — ${brand.tagline[locale === 'en' ? 'en' : 'ru']}`,
          type: 'image/jpeg',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.ogTitle,
      description: copy.ogDescription,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    other: {
      'theme-color': brand.colors.teal,
    },
  };
}

export function buildJsonLd(
  locale: Locale,
  copy: Pick<SeoCopy, 'description'>,
): Record<string, unknown> {
  const origin = absoluteUrl('/');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${brand.productionOrigin}/#organization`,
        name: brand.name,
        url: brand.productionOrigin,
        logo: absoluteUrl(brand.markPath),
        slogan: brand.tagline[locale === 'en' ? 'en' : 'ru'],
        description: copy.description,
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}#website`,
        url: absoluteUrl(`/${locale}`),
        name: brand.name,
        description: copy.description,
        inLanguage: locale,
        publisher: { '@id': `${brand.productionOrigin}/#organization` },
      },
      {
        '@type': 'WebApplication',
        name: brand.name,
        url: absoluteUrl(`/${locale}`),
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        description: copy.description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
    ],
  };
}
