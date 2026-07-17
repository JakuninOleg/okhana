import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/server/db';
import { users } from '@/lib/server/db/schema';
import { SignOutButtonClient } from './SignOutButtonClient';

// Force dynamic rendering — auth() requires request context from middleware.
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const [{ locale }, { userId }] = await Promise.all([params, auth()]);
  const [user] = userId
    ? await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1)
    : [];
  const t = await getTranslations('Dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t('greeting', { email: user?.email ?? '' })}
      </h1>
      <SignOutButtonClient locale={locale} />
    </main>
  );
}
