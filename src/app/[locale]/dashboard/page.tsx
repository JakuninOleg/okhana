import { auth, clerkClient } from '@clerk/nextjs/server';
import { getTranslations } from 'next-intl/server';
import { InviteCodeDisplay } from '@/features/family/invite-code-display';
import { FamilySetupForm } from '@/features/family/family-setup-form';
import { getDashboardFamilyData } from '@/features/family/get-dashboard-family';
import { FamilyChatLoader } from '@/features/chat/family-chat-loader';
import { isLocale } from '@/i18n/routing';
import { redirect } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const [{ locale: rawLocale }, { userId }, t] = await Promise.all([
    params,
    auth(),
    getTranslations('Dashboard'),
  ]);
  const locale = isLocale(rawLocale) ? rawLocale : 'ru';

  if (!userId) {
    redirect({ href: '/', locale });
  }

  let email = '';
  let familyName: string | null = null;
  let inviteCode: string | null = null;
  let hasFamily = false;
  let members: { email: string; familyRole: string | null }[] = [];
  let dbError: string | null = null;

  if (userId) {
    const data = await getDashboardFamilyData(userId);
    email = data.email;
    familyName = data.familyName;
    inviteCode = data.inviteCode;
    hasFamily = data.hasFamily;
    members = data.members;
    dbError = data.dbError;

    if (!email && !dbError) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
      } catch (error) {
        console.error('Failed to fetch user from Clerk API:', error);
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t('greeting', { email })}
      </h1>

      {dbError ? (
        <p className="text-sm text-destructive">{dbError}</p>
      ) : hasFamily ? (
        <div className="w-full max-w-2xl space-y-4">
          <p className="text-lg text-muted-foreground">
            {t('familyInfo', { name: familyName! })}
          </p>
          <InviteCodeDisplay code={inviteCode!} />
          <div className="space-y-2">
            <h2 className="font-semibold">{t('members')}</h2>
            <ul className="space-y-1">
              {members.map((member) => (
                <li key={member.email} className="text-sm text-muted-foreground">
                  {member.email} — {member.familyRole}
                </li>
              ))}
            </ul>
          </div>
          <FamilyChatLoader />
        </div>
      ) : (
        <FamilySetupForm />
      )}
    </main>
  );
}
