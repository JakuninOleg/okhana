'use client';

import { useClerk } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Client component that wraps the shadcn Button with Clerk's signOut logic.
 * We use a client component because Clerk's signOut function requires
 * client-side context (cookies, session) to properly clear the session.
 */
export function SignOutButtonClient({ locale }: { locale: string }): React.JSX.Element {
  const { signOut } = useClerk();
  const t = useTranslations('Dashboard');

  return (
    <Button
      size="lg"
      onClick={() => signOut({ redirectUrl: `/${locale}` })}
    >
      {t('signOut')}
    </Button>
  );
}
