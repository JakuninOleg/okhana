import { describe, expect, it } from 'vitest';
import { resolveMemberAvatarVisual } from '@/features/family/member-avatar-visual';

describe('resolveMemberAvatarVisual', () => {
  it('maps grandma to elder woman portrait', () => {
    expect(resolveMemberAvatarVisual({
      kinshipLabel: 'grandma',
      profileSex: 'female',
      familyRole: 'adult',
      birthDate: '1950-01-01',
    }).portrait).toBe('woman-elder');
  });

  it('maps wife to adult woman', () => {
    expect(resolveMemberAvatarVisual({
      kinshipLabel: 'wife',
      profileSex: 'female',
      familyRole: 'adult',
      birthDate: '1990-01-01',
    }).portrait).toBe('woman-adult');
  });

  it('maps young son to boy child', () => {
    expect(resolveMemberAvatarVisual({
      kinshipLabel: 'son',
      profileSex: 'male',
      familyRole: 'child',
      birthDate: '2018-05-01',
    }).portrait).toBe('boy-child');
  });

  it('maps teen daughter by age', () => {
    expect(resolveMemberAvatarVisual({
      kinshipLabel: 'daughter',
      profileSex: 'female',
      familyRole: 'child',
      birthDate: '2011-05-01',
    }).portrait).toBe('girl-teen');
  });

  it('falls back to sex when kinship unset', () => {
    expect(resolveMemberAvatarVisual({
      kinshipLabel: null,
      profileSex: 'male',
      familyRole: 'adult',
      birthDate: null,
    }).portrait).toBe('man-adult');
  });
});
