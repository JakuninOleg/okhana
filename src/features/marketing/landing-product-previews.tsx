'use client';

import { Bell, CalendarDays, ListTodo, Mic, SendHorizontal, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChatMessage } from '@/features/chat/chat-message';
import { FamilyMemberAvatar } from '@/features/family/family-member-avatar';
import { cn } from '@/lib/utils';

const DEMO_MEMBERS = [
  {
    id: 1,
    kinshipLabel: 'mom' as const,
    profileSex: 'female' as const,
    familyRole: 'owner' as const,
    birthDate: '1988-04-12',
    isCurrentUser: true,
  },
  {
    id: 2,
    kinshipLabel: 'dad' as const,
    profileSex: 'male' as const,
    familyRole: 'adult' as const,
    birthDate: '1986-09-03',
    isCurrentUser: false,
  },
  {
    id: 3,
    kinshipLabel: 'daughter' as const,
    profileSex: 'female' as const,
    familyRole: 'child' as const,
    birthDate: '2014-06-21',
    isCurrentUser: false,
  },
];

function DemoShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_12px_40px_-18px_rgba(26,53,51,0.35)] ring-1 ring-brand-peach/25',
        'dark:border-border/50 dark:bg-card dark:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.65)] dark:ring-brand-peach/30',
        className,
      )}
      aria-hidden
    >
      {children}
    </div>
  );
}

/** Hub header + member strip — same visual language as the dashboard. */
export function HubPreview(): React.JSX.Element {
  const t = useTranslations('Home.demo');
  const tHub = useTranslations('Dashboard.familyHub');

  return (
    <DemoShell>
      <div className="space-y-4 bg-gradient-to-b from-brand-sun/50 to-transparent p-4 sm:p-5 dark:from-brand-peach/15">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-peach">
              {tHub('title')}
            </p>
            <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {t('familyName')}
            </h3>
          </div>
          <span className="shrink-0 rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/60">
            {t('inviteCode')}
          </span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {DEMO_MEMBERS.map((member) => (
            <div
              key={member.id}
              className="flex w-[5.5rem] shrink-0 flex-col items-center gap-2 text-center"
            >
              <FamilyMemberAvatar
                member={member}
                size="lg"
                showOwnerBadge
                className={cn(
                  member.isCurrentUser
                  && 'rounded-full ring-2 ring-brand-peach ring-offset-2 ring-offset-background',
                )}
              />
              <span className="w-full space-y-0.5">
                <span className="block truncate text-sm font-medium">
                  {t(`members.${member.kinshipLabel}.name`)}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {tHub(`kinship.${member.kinshipLabel}`)}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-background/80 px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border/60">
            <ListTodo className="size-3.5 text-brand-peach" />
            {t('chipTasks')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-background/80 px-3 py-2 text-xs font-medium text-foreground ring-1 ring-border/60">
            <CalendarDays className="size-3.5 text-brand-peach" />
            {t('chipDates')}
          </span>
        </div>
      </div>
    </DemoShell>
  );
}

/** Tasks priority card — mirrors FamilyTasksPriority. */
export function TasksPreview(): React.JSX.Element {
  const t = useTranslations('Home.demo');
  const tTasks = useTranslations('Dashboard.tasks');

  const rows = [
    { title: t('task1Title'), meta: t('task1Meta'), urgent: true },
    { title: t('task2Title'), meta: t('task2Meta'), urgent: false },
    { title: t('task3Title'), meta: t('task3Meta'), urgent: false },
  ] as const;

  return (
    <DemoShell>
      <section className="rounded-none border-0 bg-brand-sun/40 p-4 shadow-none sm:p-5 dark:bg-brand-peach/12">
        <div className="mb-3 space-y-1">
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <ListTodo className="size-4 text-brand-peach" aria-hidden />
            {tTasks('priorityTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('tasksSubtitle')}</p>
        </div>
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.title}
              className={cn(
                'rounded-xl border border-border/50 bg-background/80 px-3 py-2.5',
                row.urgent && 'border-brand-peach/60',
              )}
            >
              <p className="text-sm font-medium text-foreground">{row.title}</p>
              <p className="text-xs text-muted-foreground">{row.meta}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{t('tasksHint')}</p>
      </section>
    </DemoShell>
  );
}

/** Chat panel — same bubbles as the live FamilyChat. */
export function ChatPreview({ className }: { className?: string }): React.JSX.Element {
  const t = useTranslations('Home.demo');
  const tChat = useTranslations('Dashboard.voiceChat');

  return (
    <DemoShell className={cn('flex flex-col', className)}>
      <div className="border-b border-border/60 bg-brand-sun/40 px-4 py-3 dark:bg-brand-peach/12">
        <p className="text-sm font-semibold tracking-tight">{tChat('assistantName')}</p>
        <p className="text-xs text-muted-foreground">{t('chatStatus')}</p>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <ChatMessage
          role="user"
          content={t('chatUser1')}
          assistantName={tChat('assistantName')}
          thinkingLabel={tChat('thinking')}
        />
        <ChatMessage
          role="assistant"
          content={t('chatAssistant1')}
          assistantName={tChat('assistantName')}
          thinkingLabel={tChat('thinking')}
        />
        <ChatMessage
          role="user"
          content={t('chatUser2')}
          assistantName={tChat('assistantName')}
          thinkingLabel={tChat('thinking')}
        />
        <ChatMessage
          role="assistant"
          content={t('chatAssistant2')}
          assistantName={tChat('assistantName')}
          thinkingLabel={tChat('thinking')}
        />
      </div>
      <div className="border-t border-border/60 p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/30 px-2 py-2">
          <span className="inline-flex size-10 items-center justify-center rounded-xl text-brand-peach">
            <Mic className="size-5" />
          </span>
          <span className="flex-1 truncate px-1 text-sm text-muted-foreground">
            {t('composerPlaceholder')}
          </span>
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <SendHorizontal className="size-4" />
          </span>
        </div>
      </div>
    </DemoShell>
  );
}

/** Privacy: shared note vs surprise — how it feels in the product. */
export function PrivacyPreview(): React.JSX.Element {
  const t = useTranslations('Home.demo');

  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-hidden>
      <DemoShell>
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-sage">
            {t('noteSharedLabel')}
          </p>
          <p className="text-sm font-medium text-foreground">{t('noteSharedTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('noteSharedBody')}</p>
          <p className="text-xs text-muted-foreground">{t('noteSharedMeta')}</p>
        </div>
      </DemoShell>
      <DemoShell className="border-dashed opacity-90">
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-peach">
            {t('notePrivateLabel')}
          </p>
          <p className="text-sm font-medium text-foreground">{t('notePrivateTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('notePrivateBody')}</p>
          <p className="text-xs text-muted-foreground">{t('notePrivateMeta')}</p>
        </div>
      </DemoShell>
    </div>
  );
}

/** Calendar + nudge/digest chips. */
export function CalendarPreview(): React.JSX.Element {
  const t = useTranslations('Home.demo');

  return (
    <DemoShell>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <CalendarDays className="size-4 text-brand-peach" aria-hidden />
            {t('calendarTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('calendarSubtitle')}</p>
        </div>
        <ul className="space-y-2">
          <li className="rounded-xl border border-brand-peach/50 bg-brand-sun/30 px-3 py-2.5 dark:bg-brand-peach/10">
            <p className="text-sm font-medium text-foreground">{t('date1Title')}</p>
            <p className="text-xs text-muted-foreground">{t('date1Meta')}</p>
          </li>
          <li className="rounded-xl border border-border/50 bg-background/80 px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">{t('date2Title')}</p>
            <p className="text-xs text-muted-foreground">{t('date2Meta')}</p>
          </li>
        </ul>
        <div className="space-y-2">
          <p className="inline-flex max-w-full items-center gap-2 rounded-xl bg-background/90 px-3 py-2 text-xs text-foreground ring-1 ring-border/60">
            <Bell className="size-3.5 shrink-0 text-brand-peach" aria-hidden />
            <span className="truncate">{t('nudgeChip')}</span>
          </p>
          <p className="inline-flex max-w-full items-center gap-2 rounded-xl bg-background/90 px-3 py-2 text-xs text-foreground ring-1 ring-border/60">
            <Bell className="size-3.5 shrink-0 text-brand-sage" aria-hidden />
            <span className="truncate">{t('digestChip')}</span>
          </p>
        </div>
      </div>
    </DemoShell>
  );
}

/** Home Screen / notifications affordance. */
export function PhonePreview(): React.JSX.Element {
  const t = useTranslations('Home.demo');

  return (
    <DemoShell>
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <div className="rounded-2xl bg-brand-sun/60 p-3 text-brand-peach dark:bg-brand-peach/20">
          <Smartphone className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-base font-semibold tracking-tight">{t('phoneTitle')}</h3>
          <p className="text-sm text-muted-foreground">{t('phoneBody')}</p>
          <span className="inline-flex rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            {t('phoneChip')}
          </span>
        </div>
      </div>
    </DemoShell>
  );
}

/** Compact dashboard stack for the hero — chat-first on small screens. */
export function DashboardHeroPreview(): React.JSX.Element {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="hidden space-y-4 md:block">
        <HubPreview />
        <TasksPreview />
      </div>
      <ChatPreview className="min-h-[22rem] sm:min-h-[26rem] lg:min-h-[28rem]" />
    </div>
  );
}
