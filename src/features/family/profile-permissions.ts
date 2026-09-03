import type { FamilyRole } from '@/features/family/family-member-types';

export type FamilyActor = {
  userId: number;
  familyRole: FamilyRole;
};

export type FamilyMemberTarget = {
  id: number;
  familyRole: FamilyRole | null;
};

export function canEditMemberProfile(
  actor: FamilyActor,
  target: FamilyMemberTarget,
): boolean {
  if (actor.userId === target.id) return true;
  if (actor.familyRole === 'owner') return true;
  if (actor.familyRole === 'adult') return true;
  return false;
}

export function canChangeMemberRole(actor: FamilyActor): boolean {
  return actor.familyRole === 'owner';
}

export function canTransferOwnership(
  actor: FamilyActor,
  target: FamilyMemberTarget,
): boolean {
  if (actor.familyRole !== 'owner') return false;
  if (actor.userId === target.id) return false;
  return target.familyRole === 'adult';
}

/** Owner may remove any non-owner member (not themselves). */
export function canRemoveMember(
  actor: FamilyActor,
  target: FamilyMemberTarget,
): boolean {
  if (actor.familyRole !== 'owner') return false;
  if (actor.userId === target.id) return false;
  if (target.familyRole === 'owner' || target.familyRole == null) return false;
  return true;
}
