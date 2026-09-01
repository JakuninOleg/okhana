'use client';

import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InviteCodeDisplay } from '@/features/family/invite-code-display';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export type FamilyHubMember = {
  email: string;
  familyRole: string | null;
};

type FamilyHubMenuProps = {
  familyName: string;
  inviteCode: string;
  members: FamilyHubMember[];
  displayName: string;
  userEmail: string;
};

function roleLabel(
  role: string | null,
  t: ReturnType<typeof useTranslations<'Dashboard.familyHub'>>,
): string {
  if (role === 'owner') return t('roleOwner');
  if (role === 'adult') return t('roleAdult');
  if (role === 'child') return t('roleChild');
  return t('roleUnknown');
}

export function FamilyHubMenu({
  familyName,
  inviteCode,
  members,
  displayName,
  userEmail,
}: FamilyHubMenuProps): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur-sm sm:px-4 sm:py-3">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
          {familyName}
        </p>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">
          {t('signedInAs', { name: displayName })}
        </p>
      </div>

      <Sheet>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 border-border/60"
            />
          }
        >
          <Users className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t('openMenu')}</span>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border/60 pb-4">
            <SheetTitle>{t('title')}</SheetTitle>
            <SheetDescription>{familyName}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6">
            <section className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">{t('inviteTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('inviteDescription')}</p>
              </div>
              <InviteCodeDisplay code={inviteCode} />
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-foreground">{t('membersTitle')}</h2>
              <ul className="space-y-2">
                {members.map((member) => (
                  <li
                    key={member.email}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {member.email}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {roleLabel(member.familyRole, t)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-xs text-muted-foreground">{t('comingSoon')}</p>
            {userEmail ? (
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
