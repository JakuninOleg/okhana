import type { FamilyRole } from '@/features/family/family-member-types';

export type FamilyActor = {
  userId: number;
  familyRole: FamilyRole;
};

export type FamilyMemberTarget = {
  id: number;
  familyRole: FamilyRole | null;
};

/**
 * Core profile (display name, sex, birth date): self, or adult/owner managing a child.
 * Adults do not rewrite other adults' shared identity — use viewer kinship instead.
 */
export function canEditMemberCoreProfile(
  actor: FamilyActor,
  target: FamilyMemberTarget,
): boolean {
  if (actor.userId === target.id) return true;
  if (target.familyRole !== 'child') return false;
  return actor.familyRole === 'owner' || actor.familyRole === 'adult';
}

/**
 * Kinship is personal: any member may set how *they* address another member.
 * Labels are viewer-specific and never overwrite someone else's view.
 */
export function canSetViewerKinship(
  actor: FamilyActor,
  target: FamilyMemberTarget,
): boolean {
  if (actor.userId === target.id) return false;
  return target.familyRole != null;
}

/** Sheet "Edit" — core fields and/or personal kinship label. */
export function canEditMemberProfile(
  actor: FamilyActor,
  target: FamilyMemberTarget,
): boolean {
  return canEditMemberCoreProfile(actor, target) || canSetViewerKinship(actor, target);
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

/** Non-owner members may leave; owner must transfer first. */
export function canLeaveFamily(actor: FamilyActor): boolean {
  return actor.familyRole === 'adult' || actor.familyRole === 'child';
}

export function canRotateInviteCode(actor: FamilyActor): boolean {
  return actor.familyRole === 'owner';
}
