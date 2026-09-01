import Image from 'next/image';
import { auth } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { SignOutButtonClient } from '@/features/family/SignOutButtonClient';
import { Link } from '@/i18n/navigation';
import { getServerTheme } from '@/lib/theme';

export async function Navbar({ locale }: { locale: string }) {
  const { userId } = await auth();
  const t = await getTranslations('Navbar');
  const theme = await getServerTheme();

  return (
    <nav className="sticky top-0 z-40 border-b border-border/70 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <Container className="flex items-center justify-between gap-3 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/okhana-mark.webp"
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-full object-cover ring-1 ring-brand-peach/40"
            priority
            sizes="36px"
          />
          <span className="text-base font-semibold tracking-[0.04em] text-foreground">
            {t('brand')}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle currentTheme={theme} />
          {userId ? (
            <SignOutButtonClient locale={locale} />
          ) : (
            <Link href="/sign-in" className={buttonVariants({ variant: 'default', size: 'sm', className: 'w-24 justify-center' })}>
              {t('signIn')}
            </Link>
          )}
        </div>
      </Container>
    </nav>
  );
}
