import { auth, clerkClient } from '@clerk/nextjs/server';
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

  // Try to get email from Supabase (synced via Clerk webhook).
  // Fall back to Clerk API if the DB query fails or the user hasn't been
  // synced yet — this happens in local dev where Clerk webhooks can't
  // reach localhost.
  let email = '';
  if (userId) {
    try {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);
      email = user?.email ?? '';
    } catch {
      // DB query failed (connection issue, table not synced, etc.)
      // Fall back to Clerk API to get the user's email.
    }

    if (!email) {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
    }
  }

  const t = await getTranslations('Dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t('greeting', { email })}
      </h1>
      <SignOutButtonClient locale={locale} />
    </main>
  );
}
