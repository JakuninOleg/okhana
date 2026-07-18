import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/server/db';
import { families, users } from '@/lib/server/db/schema';
import { ensureUserExists } from '@/lib/server/db/queries/users';
import { redirect } from '@/i18n/navigation';
import { SignOutButtonClient } from './SignOutButtonClient';
import { FamilySetupForm } from './family-setup-form';
import { InviteCodeDisplay } from './invite-code-display';

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

  // After the guard above, userId is guaranteed non-null. redirect() throws
  // to halt rendering, but TypeScript doesn't know that — use a non-null
  // assertion so downstream calls (ensureUserExists, eq) type-check.
  const clerkUserId = userId!;

  // ROBUST user sync: ensure the user exists in Supabase BEFORE querying
  // family data. The Clerk webhook may have failed (misconfigured endpoint,
  // wrong secret, production instance not set up) — without this upsert the
  // user would see a broken dashboard and could not create/join a family
  // (foreign-key constraints fail). The webhook remains an optimisation;
  // this is the critical path.
  let email = '';
  let dbError: string | null = null;
  try {
    const ensured = await ensureUserExists(clerkUserId);
    email = ensured.email;
  } catch (e) {
    // If even the upsert fails (DB down, Clerk API down), we still render
    // the page — the user just sees an empty greeting. Family operations
    // will surface their own errors.
    dbError = e instanceof Error ? e.message : 'Failed to sync user';
    console.error('Failed to ensure user exists:', e);
  }

  // Query family info from Supabase (now that the user row is guaranteed).
  let familyName: string | null = null;
  let familyId: number | null = null;
  let inviteCode: string | null = null;
  let hasFamily = false;

  if (!dbError) {
    try {
      const [result] = await db
        .select({
          familyId: families.id,
          familyName: families.name,
          inviteCode: families.inviteCode,
        })
        .from(users)
        .leftJoin(families, eq(users.familyId, families.id))
        .where(eq(users.clerkId, clerkUserId))
        .limit(1);

      familyName = result?.familyName ?? null;
      familyId = result?.familyId ?? null;
      inviteCode = result?.inviteCode ?? null;
      hasFamily = familyName !== null;
    } catch (e) {
      dbError = e instanceof Error ? e.message : 'Database query failed';
      console.error('Failed to query family info:', e);
    }
  }

  // Fetch family members if the user belongs to a family.
  // Wrapped in try-catch separately — a connection drop here must not crash
  // the entire Server Component render.
  let members: { email: string; familyRole: string | null }[] = [];
  if (hasFamily && familyId) {
    try {
      members = await db
        .select({ email: users.email, familyRole: users.familyRole })
        .from(users)
        .where(eq(users.familyId, familyId));
    } catch (e) {
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
