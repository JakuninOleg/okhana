import { ClerkProvider } from '@clerk/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import "../globals.css";

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
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();
  
  return (
    <html lang={locale}>
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: 'var(--primary)',
              colorText: 'var(--foreground)',
              colorBackground: 'var(--background)',
              colorInputBackground: 'var(--background)',
              borderRadius: 'var(--radius)',
            } as Record<string, string>,
          }}
        >
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

