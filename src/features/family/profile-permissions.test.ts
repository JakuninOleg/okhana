import { describe, expect, it } from 'vitest';
import {
  canChangeMemberRole,
  canEditMemberCoreProfile,
  canEditMemberProfile,
  canLeaveFamily,
  canRemoveMember,
  canRotateInviteCode,
  canSetViewerKinship,
  canTransferOwnership,
} from '@/features/family/profile-permissions';

describe('profile-permissions', () => {
  const owner = { userId: 1, familyRole: 'owner' as const };
  const adult = { userId: 2, familyRole: 'adult' as const };
  const child = { userId: 3, familyRole: 'child' as const };

  it('allows self core edit for any role', () => {
    expect(canEditMemberCoreProfile(child, { id: 3, familyRole: 'child' })).toBe(true);
  });

  it('allows adults/owners to edit child core profile only', () => {
    expect(canEditMemberCoreProfile(owner, { id: 3, familyRole: 'child' })).toBe(true);
    expect(canEditMemberCoreProfile(adult, { id: 3, familyRole: 'child' })).toBe(true);
    expect(canEditMemberCoreProfile(adult, { id: 1, familyRole: 'owner' })).toBe(false);
    expect(canEditMemberCoreProfile(owner, { id: 2, familyRole: 'adult' })).toBe(false);
  });

  it('allows any member to set viewer kinship for others', () => {
    expect(canSetViewerKinship(child, { id: 2, familyRole: 'adult' })).toBe(true);
    expect(canSetViewerKinship(adult, { id: 1, familyRole: 'owner' })).toBe(true);
    expect(canSetViewerKinship(adult, { id: 2, familyRole: 'adult' })).toBe(false);
  });

  it('exposes edit profile when core or kinship is allowed', () => {
    expect(canEditMemberProfile(adult, { id: 1, familyRole: 'owner' })).toBe(true);
    expect(canEditMemberProfile(child, { id: 2, familyRole: 'adult' })).toBe(true);
  });

  it('only owner can change roles', () => {
    expect(canChangeMemberRole(owner)).toBe(true);
    expect(canChangeMemberRole(adult)).toBe(false);
  });

  it('only owner can transfer to another adult', () => {
    expect(canTransferOwnership(owner, { id: 2, familyRole: 'adult' })).toBe(true);
    expect(canTransferOwnership(owner, { id: 1, familyRole: 'owner' })).toBe(false);
    expect(canTransferOwnership(owner, { id: 3, familyRole: 'child' })).toBe(false);
    expect(canTransferOwnership(adult, { id: 2, familyRole: 'adult' })).toBe(false);
  });

  it('only owner can remove non-owner members', () => {
    expect(canRemoveMember(owner, { id: 2, familyRole: 'adult' })).toBe(true);
    expect(canRemoveMember(owner, { id: 3, familyRole: 'child' })).toBe(true);
    expect(canRemoveMember(owner, { id: 1, familyRole: 'owner' })).toBe(false);
    expect(canRemoveMember(adult, { id: 3, familyRole: 'child' })).toBe(false);
  });

  it('non-owners can leave; only owner rotates invite', () => {
    expect(canLeaveFamily(adult)).toBe(true);
    expect(canLeaveFamily(child)).toBe(true);
    expect(canLeaveFamily(owner)).toBe(false);
    expect(canRotateInviteCode(owner)).toBe(true);
    expect(canRotateInviteCode(adult)).toBe(false);
  });
});
