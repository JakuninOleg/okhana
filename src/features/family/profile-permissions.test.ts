import { describe, expect, it } from 'vitest';
import {
  canChangeMemberRole,
  canEditMemberProfile,
  canRemoveMember,
  canTransferOwnership,
} from '@/features/family/profile-permissions';

describe('profile-permissions', () => {
  const owner = { userId: 1, familyRole: 'owner' as const };
  const adult = { userId: 2, familyRole: 'adult' as const };
  const child = { userId: 3, familyRole: 'child' as const };

  it('allows self-edit for any role', () => {
    expect(canEditMemberProfile(child, { id: 3, familyRole: 'child' })).toBe(true);
  });

  it('allows owner and adult to edit others', () => {
    expect(canEditMemberProfile(owner, { id: 2, familyRole: 'adult' })).toBe(true);
    expect(canEditMemberProfile(adult, { id: 3, familyRole: 'child' })).toBe(true);
  });

  it('denies child editing others', () => {
    expect(canEditMemberProfile(child, { id: 2, familyRole: 'adult' })).toBe(false);
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
});
