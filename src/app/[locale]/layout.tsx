import { ClerkProvider } from '@clerk/nextjs';
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Navbar } from '@/components/navbar';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';
import "../globals.css";
import { Container } from '@/components/ui/container';
import { getServerTheme } from '@/lib/theme';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

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
  const theme = await getServerTheme();
   
  return (
    <html lang={locale} className={`${theme} ${plusJakartaSans.variable} ${geistMono.variable}`}>
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
            <Navbar locale={locale} />
            <Container>
              {children}
            </Container>
          </NextIntlClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
