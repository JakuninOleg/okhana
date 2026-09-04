import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FamilyHubMenu } from '@/features/family/family-hub-menu';
import { FamilySetupForm } from '@/features/family/family-setup-form';
import { getDashboardFamilyData } from '@/features/family/get-dashboard-family';
import { FamilyChatLoader } from '@/features/chat/family-chat-loader';
import { FamilyTasksPriority } from '@/features/tasks/family-tasks-priority';
import { loadDashboardActiveTasks } from '@/features/tasks/load-dashboard-tasks';
import { isLocale, routing } from '@/i18n/routing';
import { redirect } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const [{ locale: rawLocale }, { userId }] = await Promise.all([params, auth()]);
  const locale = isLocale(rawLocale) ? rawLocale : 'ru';
  const [t, tOnboarding] = await Promise.all([
    getTranslations({ locale, namespace: 'Dashboard' }),
    getTranslations({ locale, namespace: 'Dashboard.onboarding' }),
  ]);

  if (!userId) {
    redirect({ href: '/', locale });
  }

  let email = '';
  let displayName = '';
  let familyName: string | null = null;
  let inviteCode: string | null = null;
  let hasFamily = false;
  let currentUserId: number | null = null;
  let currentUserRole: 'owner' | 'adult' | 'child' | null = null;
  let members: Awaited<ReturnType<typeof getDashboardFamilyData>>['members'] = [];
  let dbError: string | null = null;

  if (userId) {
    const data = await getDashboardFamilyData(userId);
    email = data.email;
    displayName = data.userDisplayName;
    familyName = data.familyName;
    inviteCode = data.inviteCode;
    hasFamily = data.hasFamily;
    currentUserId = data.currentUserId;
    currentUserRole = (data.currentUserRole as typeof currentUserRole) ?? null;
    members = data.members;
    dbError = data.dbError;
  }

  const activeTasks = hasFamily ? await loadDashboardActiveTasks() : [];

  if (!displayName && email) {
    displayName = email.split('@')[0] ?? email;
  }

  if (dbError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('greeting', { email })}
        </h1>
        <p className="text-sm text-destructive">{dbError}</p>
      </main>
    );
  }

  if (!hasFamily) {
    return (
      <main className="relative flex flex-1 flex-col py-6 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--brand-sun)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom,_var(--brand-aqua)_0%,_transparent_50%)] opacity-60 dark:opacity-20"
        />
        <div className="relative mx-auto flex w-full max-w-lg flex-col gap-6 px-1">
          <header className="space-y-2 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-peach">
              {tOnboarding('eyebrow')}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {tOnboarding('welcome', { name: displayName })}
            </h1>
            <p className="text-base font-medium text-foreground">
              {tOnboarding('title')}
            </p>
            <p className="text-sm text-muted-foreground sm:text-base">
              {tOnboarding('subtitle')}
            </p>
          </header>
          <FamilySetupForm />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col py-3 sm:py-4 lg:min-h-0">
      <FamilyHubMenu
        familyName={familyName!}
        inviteCode={inviteCode!}
        members={members}
        currentUserId={currentUserId!}
        currentUserRole={currentUserRole!}
      >
        <FamilyTasksPriority initialTasks={activeTasks} />
        <FamilyChatLoader />
      </FamilyHubMenu>
    </main>
  );
}
