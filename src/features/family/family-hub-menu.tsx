'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ageFromBirthDate,
  memberDisplayLabel,
  type DashboardFamilyMemberProfile,
  type FamilyRole,
} from '@/features/family/family-member-types';
import { FamilyMemberAvatar } from '@/features/family/family-member-avatar';
import { InviteCodeDisplay } from '@/features/family/invite-code-display';
import { MemberProfileSheet } from '@/features/family/member-profile-sheet';
import { FamilyTasksSheet } from '@/features/tasks/family-tasks-sheet';
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
}: {
  familyName: string;
  inviteCode: string;
}): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={t('familySettings')}
          />
        }
      >
        <Settings2 className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle>{t('familySettings')}</SheetTitle>
          <SheetDescription>{familyName}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">{t('inviteTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('inviteDescription')}</p>
          </div>
          <InviteCodeDisplay code={inviteCode} />
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
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
      <aside className="hidden w-72 shrink-0 flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur-sm lg:flex xl:w-80">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-xl font-semibold tracking-tight">{familyName}</p>
            <p className="text-sm text-muted-foreground">
              {t('membersCount', { count: members.length })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <FamilyTasksSheet />
            <FamilySettingsSheet familyName={familyName} inviteCode={inviteCode} />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <section className="shrink-0 rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-sm sm:p-4 lg:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight">{familyName}</p>
              <p className="text-sm text-muted-foreground">
                {t('membersCount', { count: members.length })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <FamilyTasksSheet />
              <FamilySettingsSheet familyName={familyName} inviteCode={inviteCode} />
            </div>
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

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
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
