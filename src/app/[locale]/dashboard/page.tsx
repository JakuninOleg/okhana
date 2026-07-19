import { auth, clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/server/db';
import { families, users } from '@/lib/server/db/schema';
import { redirect } from '@/i18n/navigation';
import { FamilySetupForm } from '@/features/family/family-setup-form';
import { InviteCodeDisplay } from '@/features/family/invite-code-display';
import { SignOutButtonClient } from '@/features/family/SignOutButtonClient';

// Force dynamic rendering — auth() requires request context from middleware.
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const [{ locale }, { userId }] = await Promise.all([params, auth()]);

  // Explicit auth guard — middleware protects routes, but defence-in-depth:
  // redirect unauthenticated users to the home page instead of rendering
  // the dashboard with an empty email.
  if (!userId) {
    redirect({ href: '/', locale });
  }

  // Try to get email and family info from Supabase (synced via Clerk webhook).
  // Fall back to Clerk API if the DB query fails or the user hasn't been
  // synced yet — this happens in local dev where Clerk webhooks can't
  // reach localhost.
  let email = '';
  let familyName: string | null = null;
  let familyId: number | null = null;
  let inviteCode: string | null = null;
  let hasFamily = false;
  let dbError: string | null = null;

  if (userId) {
    try {
      const [result] = await db
        .select({
          email: users.email,
          familyId: families.id,
          familyName: families.name,
          inviteCode: families.inviteCode,
        })
        .from(users)
        .leftJoin(families, eq(users.familyId, families.id))
        .where(eq(users.clerkId, userId))
        .limit(1);

      email = result?.email ?? '';
      familyName = result?.familyName ?? null;
      familyId = result?.familyId ?? null;
      inviteCode = result?.inviteCode ?? null;
      hasFamily = familyName !== null;
    } catch (e) {
      // DB query failed — likely a connection issue or the table hasn't
      // been created yet. Store the error to display instead of silently
      // showing the setup form, which would cause a confusing UX.
      dbError = e instanceof Error ? e.message : 'Database connection failed';
    }

    if (!email && !dbError) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
      } catch (e) {
        // Clerk API failure (rate limit, network, etc.) — don't crash the
        // page. The user will see an empty greeting, recoverable on reload.
        console.error('Failed to fetch user from Clerk API:', e);
      }
    }
  }

  // Fetch family members if the user belongs to a family.
  // Wrapped in try-catch separately from the main query — a connection drop
  // here must not crash the entire Server Component render. In production
  // Next.js masks such errors as a generic "An error occurred in the Server
  // Components render", which is opaque to the user.
  let members: { email: string; familyRole: string | null }[] = [];
  if (hasFamily && familyId) {
    try {
      members = await db
        .select({ email: users.email, familyRole: users.familyRole })
        .from(users)
        .where(eq(users.familyId, familyId));
    } catch (e) {
      // Non-critical: show the family info without the members list rather
      // than crashing the whole page.
      console.error('Failed to fetch family members:', e);
    }
  }

  const t = await getTranslations('Dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t('greeting', { email })}
      </h1>

      {dbError ? (
        <p className="text-sm text-destructive">{dbError}</p>
      ) : hasFamily ? (
        <div className="w-full max-w-md space-y-4">
          <p className="text-lg text-muted-foreground">
            {t('familyInfo', { name: familyName! })}
          </p>
          <InviteCodeDisplay code={inviteCode!} />
          <div className="space-y-2">
            <h2 className="font-semibold">{t('members')}</h2>
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.email} className="text-sm text-muted-foreground">
                  {m.email} — {m.familyRole}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <FamilySetupForm />
      )}

      <SignOutButtonClient locale={locale} />
    </main>
  );
}
