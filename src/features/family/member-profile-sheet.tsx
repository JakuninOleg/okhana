'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  ageFromBirthDate,
  KINSHIP_OPTIONS,
  memberDisplayLabel,
  type DashboardFamilyMemberProfile,
  type FamilyRole,
  type KinshipOption,
} from '@/features/family/family-member-types';
import { FamilyMemberAvatar } from '@/features/family/family-member-avatar';
import {
  canChangeMemberRole,
  canEditMemberProfile,
  canRemoveMember,
  canTransferOwnership,
} from '@/features/family/profile-permissions';
import {
  removeFamilyMember,
  transferFamilyOwnership,
  updateMemberProfile,
} from '@/features/family/profile-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type MemberProfileSheetProps = {
  member: DashboardFamilyMemberProfile | null;
  currentUserId: number;
  currentUserRole: FamilyRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const fieldClass =
  'flex h-10 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm';

export function MemberProfileSheet({
  member,
  currentUserId,
  currentUserRole,
  open,
  onOpenChange,
}: MemberProfileSheetProps): React.JSX.Element | null {
  const t = useTranslations('Dashboard.familyHub');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  /** Editing is scoped to member id so closing/switching members exits edit without an effect. */
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!member) {
    return null;
  }

  const activeMember = member;
  const isEditing = editingMemberId === activeMember.id;
  const label = memberDisplayLabel(activeMember);
  const actor = { userId: currentUserId, familyRole: currentUserRole };
  const canEdit = canEditMemberProfile(actor, {
    id: activeMember.id,
    familyRole: activeMember.familyRole,
  });
  const canEditRole = canChangeMemberRole(actor) && activeMember.familyRole !== 'owner';
  const canTransfer = canTransferOwnership(actor, {
    id: activeMember.id,
    familyRole: activeMember.familyRole,
  });
  const canRemove = canRemoveMember(actor, {
    id: activeMember.id,
    familyRole: activeMember.familyRole,
  });
  const age = ageFromBirthDate(activeMember.birthDate);
  const kinship = activeMember.kinshipLabel
    ? t(`kinship.${activeMember.kinshipLabel}` as 'kinship.mom')
    : null;

  function handleSubmit(formData: FormData): void {
    setErrorKey(null);
    startTransition(async () => {
      const result = await updateMemberProfile({
        memberId: activeMember.id,
        displayName: String(formData.get('displayName') ?? ''),
        kinshipLabel: String(formData.get('kinshipLabel') ?? '') as '' | KinshipOption,
        profileSex: String(formData.get('profileSex') ?? 'unspecified') as 'female' | 'male' | 'unspecified',
        birthDate: String(formData.get('birthDate') ?? ''),
        familyRole: canEditRole
          ? (String(formData.get('familyRole') ?? '') as FamilyRole)
          : undefined,
      });
      if (!result.ok) {
        setErrorKey(result.error);
        return;
      }
      setEditingMemberId(null);
      onOpenChange(false);
    });
  }

  function handleTransfer(): void {
    setErrorKey(null);
    startTransition(async () => {
      const result = await transferFamilyOwnership({ newOwnerMemberId: activeMember.id });
      if (!result.ok) {
        setErrorKey(result.error);
        return;
      }
      setEditingMemberId(null);
      onOpenChange(false);
    });
  }

  function handleRemove(): void {
    setErrorKey(null);
    startTransition(async () => {
      const result = await removeFamilyMember({ memberId: activeMember.id });
      if (!result.ok) {
        setErrorKey(result.error);
        return;
      }
      setEditingMemberId(null);
      onOpenChange(false);
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEditingMemberId(null);
          setErrorKey(null);
        }
        onOpenChange(next);
      }}
    >
      <SheetContent side="center" className="overflow-y-auto">
        <SheetHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center gap-4">
            <FamilyMemberAvatar member={activeMember} size="2xl" showOwnerBadge />
            <div className="min-w-0 space-y-1">
              <SheetTitle className="text-xl">{label}</SheetTitle>
              <SheetDescription className="text-sm">
                {[kinship, age !== null ? t('ageHint', { age }) : null]
                  .filter(Boolean)
                  .join(' · ') || activeMember.email}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {!isEditing ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('displayNameLabel')}</dt>
                <dd className="font-medium text-foreground">{label}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('kinshipLabel')}</dt>
                <dd className="font-medium text-foreground">{kinship ?? t('kinshipUnset')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('emailLabel')}</dt>
                <dd className="truncate font-medium text-foreground">{activeMember.email}</dd>
              </div>
              {age !== null ? (
                <div>
                  <dt className="text-muted-foreground">{t('birthDateLabel')}</dt>
                  <dd className="font-medium text-foreground">{t('ageHint', { age })}</dd>
                </div>
              ) : null}
            </dl>

            {errorKey ? (
              <p className="text-sm text-destructive">{t(`errors.${errorKey}`)}</p>
            ) : null}

            {canEdit ? (
              <Button
                type="button"
                onClick={() => {
                  setErrorKey(null);
                  setEditingMemberId(activeMember.id);
                }}
              >
                {t('editMember')}
              </Button>
            ) : null}

            {canRemove ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleRemove}
              >
                {isPending ? t('removing') : t('removeMember')}
              </Button>
            ) : null}
          </div>
        ) : (
          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit(new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="displayName">{t('displayNameLabel')}</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={activeMember.displayName ?? label}
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kinshipLabel">{t('kinshipLabel')}</Label>
              <select
                id="kinshipLabel"
                name="kinshipLabel"
                className={fieldClass}
                defaultValue={activeMember.kinshipLabel ?? ''}
              >
                <option value="">{t('kinshipUnset')}</option>
                {KINSHIP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`kinship.${option}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileSex">{t('sexLabel')}</Label>
              <select
                id="profileSex"
                name="profileSex"
                className={fieldClass}
                defaultValue={activeMember.profileSex}
              >
                <option value="unspecified">{t('sexUnspecified')}</option>
                <option value="female">{t('sexFemale')}</option>
                <option value="male">{t('sexMale')}</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">{t('birthDateLabel')}</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={activeMember.birthDate ?? ''}
              />
              {age !== null ? (
                <p className="text-xs text-muted-foreground">{t('ageHint', { age })}</p>
              ) : null}
            </div>

            {canEditRole ? (
              <div className="space-y-2">
                <Label htmlFor="familyRole">{t('roleLabel')}</Label>
                <select
                  id="familyRole"
                  name="familyRole"
                  className={fieldClass}
                  defaultValue={activeMember.familyRole ?? 'adult'}
                >
                  <option value="adult">{t('roleAdult')}</option>
                  <option value="child">{t('roleChild')}</option>
                </select>
              </div>
            ) : null}

            {errorKey ? (
              <p className="text-sm text-destructive">{t(`errors.${errorKey}`)}</p>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => {
                  setErrorKey(null);
                  setEditingMemberId(null);
                }}
              >
                {t('cancelEdit')}
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? t('saving') : t('saveMember')}
              </Button>
            </div>

            {canTransfer ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={handleTransfer}
              >
                {t('transferOwnership')}
              </Button>
            ) : null}

            {canRemove ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleRemove}
              >
                {isPending ? t('removing') : t('removeMember')}
              </Button>
            ) : null}
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
