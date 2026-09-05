import { ClerkProvider } from '@clerk/nextjs';
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Navbar } from '@/components/navbar';
import { PwaRegister } from '@/components/pwa-register';
import { Container } from '@/components/ui/container';
import { brand } from '@/lib/brand';
import { clerkAppearance } from '@/lib/clerk-appearance';
import { buildJsonLd, buildLocaleMetadata } from '@/lib/seo';
import { isLocale, routing } from '@/i18n/routing';
import { getServerTheme } from '@/lib/theme';
import { notFound } from 'next/navigation';
import '../globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: brand.colors.teal },
    { media: '(prefers-color-scheme: dark)', color: brand.colors.tealDeep },
  ],
  colorScheme: 'light dark',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'Meta' });
  return buildLocaleMetadata(locale, {
    title: t('title'),
    description: t('description'),
    ogTitle: t('ogTitle'),
    ogDescription: t('ogDescription'),
  });
}

// Note: generateStaticParams is intentionally omitted.
// With Clerk auth(), pages need request context from the proxy/middleware.
// generateStaticParams causes prerendering at build time, which bypasses
// the proxy and makes auth() fail.

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;

  if (!routing.locales.includes(raw as (typeof routing.locales)[number])) {
    notFound();
  }

  const locale = isLocale(raw) ? raw : routing.defaultLocale;
  const [messages, theme, tMeta] = await Promise.all([
    getMessages(),
    getServerTheme(),
    getTranslations({ locale, namespace: 'Meta' }),
  ]);
  const jsonLd = buildJsonLd(locale, { description: tMeta('description') });

  return (
    <html lang={locale} className={`${theme} ${plusJakartaSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ClerkProvider appearance={clerkAppearance}>
          <NextIntlClientProvider messages={messages}>
            <Navbar locale={locale} />
            <Container className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
              {children}
            </Container>
            <PwaRegister />
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
