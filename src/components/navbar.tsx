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
    <nav className="flex items-center justify-between border-b p-4">
      <Container className="flex justify-between items-center">
        <Link href="/" className="font-semibold tracking-tight">
          Okhana
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
