'use client';

import { useState, useTransition } from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ageFromBirthDate,
  memberDisplayLabel,
  type DashboardFamilyMemberProfile,
  type FamilyRole,
} from '@/features/family/family-member-types';
import { FamilyMemberAvatar } from '@/features/family/family-member-avatar';
import { FamilyDatesSheet } from '@/features/family/family-dates-sheet';
import { InviteCodeDisplay } from '@/features/family/invite-code-display';
import { MemberProfileSheet } from '@/features/family/member-profile-sheet';
import { leaveFamily, rotateInviteCode } from '@/features/family/actions';
import { FamilyCalendarSheet } from '@/features/calendar/family-calendar-sheet';
import { FamilyNotesSheet } from '@/features/notes/family-notes-sheet';
import { HubToolbar, HubToolbarIcon, HubToolbarLabel, hubToolbarTriggerClassName } from '@/features/family/hub-toolbar';
import { PushNotificationsSettings } from '@/features/notifications/push-notifications-settings';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type FamilyHubMenuProps = {
  familyName: string;
  inviteCode: string;
  members: DashboardFamilyMemberProfile[];
  currentUserId: number;
  currentUserRole: FamilyRole;
  children: React.ReactNode;
};

function kinshipOrRole(
  member: DashboardFamilyMemberProfile,
  t: ReturnType<typeof useTranslations<'Dashboard.familyHub'>>,
): string {
  if (member.kinshipLabel) {
    return t(`kinship.${member.kinshipLabel}` as 'kinship.mom');
  }
  if (member.familyRole === 'owner') return t('roleOwner');
  if (member.familyRole === 'adult') return t('roleAdult');
  if (member.familyRole === 'child') return t('roleChild');
  return t('roleUnknown');
}

function MemberButton({
  member,
  onOpen,
  layout,
}: {
  member: DashboardFamilyMemberProfile;
  onOpen: () => void;
  layout: 'rail' | 'strip';
}): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');
  const label = memberDisplayLabel(member);
  const age = ageFromBirthDate(member.birthDate);
  const subtitle = [
    kinshipOrRole(member, t),
    age !== null ? t('ageShort', { age }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (layout === 'strip') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-[6.5rem] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl p-1.5 text-center transition-colors',
          'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-peach/50',
        )}
      >
        <FamilyMemberAvatar
          member={member}
          size="xl"
          showOwnerBadge
          alt={t('memberAvatarAlt', { name: label })}
          className={cn(
            member.isCurrentUser
            && 'rounded-full ring-2 ring-brand-peach ring-offset-2 ring-offset-background',
          )}
        />
        <span className="w-full space-y-0.5">
          <span className="block truncate text-sm font-medium text-foreground">{label}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors',
        'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-peach/50',
        member.isCurrentUser && 'bg-brand-sun/40',
      )}
    >
      <FamilyMemberAvatar
        member={member}
        size="lg"
        showOwnerBadge
        alt={t('memberAvatarAlt', { name: label })}
        className={cn(
          member.isCurrentUser
          && 'rounded-full ring-2 ring-brand-peach ring-offset-2 ring-offset-background',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium text-foreground">{label}</span>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}

function FamilySettingsSheet({
  familyName,
  inviteCode,
  currentUserRole,
}: {
  familyName: string;
  inviteCode: string;
  currentUserRole: FamilyRole;
}): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRotate(): void {
    setErrorKey(null);
    startTransition(async () => {
      const result = await rotateInviteCode();
      if (!result.ok) {
        setErrorKey(result.error);
      }
    });
  }

  function handleLeave(): void {
    setErrorKey(null);
    startTransition(async () => {
      const result = await leaveFamily();
      if (!result.ok) {
        setErrorKey(result.error);
      }
    });
  }

  return (
    <Sheet>
      <SheetTrigger
        className={hubToolbarTriggerClassName()}
        aria-label={t('familySettings')}
      >
        <HubToolbarIcon>
          <Settings2 />
        </HubToolbarIcon>
        <HubToolbarLabel>{t('settingsShort')}</HubToolbarLabel>
      </SheetTrigger>
      <SheetContent side="center" className="overflow-y-auto">
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle>{t('familySettings')}</SheetTitle>
          <SheetDescription>{familyName}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">{t('inviteTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('inviteDescription')}</p>
          </div>
          <InviteCodeDisplay code={inviteCode} />
          {currentUserRole === 'owner' ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={handleRotate}
            >
              {isPending ? t('rotatingInvite') : t('rotateInvite')}
            </Button>
          ) : null}
          {currentUserRole !== 'owner' ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleLeave}
            >
              {isPending ? t('leavingFamily') : t('leaveFamily')}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t('ownerLeaveHint')}</p>
          )}
          {errorKey ? (
            <p className="text-sm text-destructive">{t(`errors.${errorKey}`)}</p>
          ) : null}
          <PushNotificationsSettings />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function FamilyHubMenu({
  familyName,
  inviteCode,
  members,
  currentUserId,
  currentUserRole,
  children,
}: FamilyHubMenuProps): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');
  const [selectedMember, setSelectedMember] = useState<DashboardFamilyMemberProfile | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-3 lg:min-h-0 lg:flex-row lg:gap-4 lg:overflow-hidden">
      {/* Desktop: fixed-height shell — page does not scroll; chat owns the scrollport. */}
      <aside
        className={cn(
          'hidden w-72 shrink-0 flex-col gap-4 rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-sm dark:border-border dark:bg-card xl:w-80',
          'lg:flex lg:overflow-y-auto',
        )}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xl font-semibold tracking-tight">{familyName}</p>
            <p className="text-sm text-muted-foreground">
              {t('membersCount', { count: members.length })}
            </p>
          </div>
          <HubToolbar>
            <FamilyNotesSheet />
            <FamilyCalendarSheet />
            <FamilyDatesSheet />
            <FamilySettingsSheet
              familyName={familyName}
              inviteCode={inviteCode}
              currentUserRole={currentUserRole}
            />
          </HubToolbar>
        </div>

        <div className="shrink-0 space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-[0.16em] text-brand-peach">
            {t('membersTitle')}
          </p>
          <ul className="space-y-1">
            {members.map((member) => (
              <li key={member.id}>
                <MemberButton
                  member={member}
                  layout="rail"
                  onOpen={() => setSelectedMember(member)}
                />
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:overflow-hidden">
        <section className="shrink-0 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm backdrop-blur-sm dark:border-border dark:bg-card sm:p-4 lg:hidden">
          <div className="mb-3 space-y-3">
            <div className="space-y-1">
              <p className="text-lg font-semibold tracking-tight">{familyName}</p>
              <p className="text-sm text-muted-foreground">
                {t('membersCount', { count: members.length })}
              </p>
            </div>
            <HubToolbar>
              <FamilyNotesSheet />
              <FamilyCalendarSheet />
              <FamilyDatesSheet />
              <FamilySettingsSheet
                familyName={familyName}
                inviteCode={inviteCode}
                currentUserRole={currentUserRole}
              />
            </HubToolbar>
          </div>
          <ul className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-1 snap-x snap-mandatory">
            {members.map((member) => (
              <li key={member.id}>
                <MemberButton
                  member={member}
                  layout="strip"
                  onOpen={() => setSelectedMember(member)}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Tasks shrink-0; chat flex-1 — only the message list scrolls on lg+. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
      </div>

      <MemberProfileSheet
        member={selectedMember}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        open={selectedMember !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedMember(null);
        }}
      />
    </div>
  );
}
