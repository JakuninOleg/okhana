import { auth } from '@clerk/nextjs/server';
import { LandingPageV2 } from '@/features/marketing/landing-page-v2';
import { redirect } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export default async function LandingV2Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const [{ locale }, { userId }] = await Promise.all([params, auth()]);

  if (userId) {
    redirect({ href: '/dashboard', locale });
  }

  return <LandingPageV2 />;
}
