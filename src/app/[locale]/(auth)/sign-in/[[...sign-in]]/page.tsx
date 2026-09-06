import { auth } from '@clerk/nextjs/server';
import { SignIn } from '@clerk/nextjs';
import { redirect } from '@/i18n/navigation';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const [{ locale }, { userId }] = await Promise.all([params, auth()]);

  if (userId) {
    redirect({ href: '/dashboard', locale });
  }

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center p-6">
      <SignIn
        fallbackRedirectUrl={`/${locale}/dashboard`}
        forceRedirectUrl={`/${locale}/dashboard`}
      />
    </main>
  );
}
