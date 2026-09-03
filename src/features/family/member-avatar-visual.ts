import {
  ageFromBirthDate,
  type FamilyRole,
  type ProfileSex,
} from '@/features/family/family-member-types';

export type MemberPortraitKey =
  | 'woman-adult'
  | 'woman-elder'
  | 'man-adult'
  | 'man-elder'
  | 'girl-child'
  | 'girl-teen'
  | 'boy-child'
  | 'boy-teen';

export type MemberAvatarVisual = {
  portrait: MemberPortraitKey;
  imageSrc: string;
  shellClass: string;
};

const PORTRAIT_SRC: Record<MemberPortraitKey, string> = {
  'woman-adult': '/brand/members/member-woman-adult.webp',
  'woman-elder': '/brand/members/member-woman-elder.webp',
  'man-adult': '/brand/members/member-man-adult.webp',
  'man-elder': '/brand/members/member-man-elder.webp',
  'girl-child': '/brand/members/member-girl-child.webp',
  'girl-teen': '/brand/members/member-girl-teen.webp',
  'boy-child': '/brand/members/member-boy-child.webp',
  'boy-teen': '/brand/members/member-boy-teen.webp',
};

const SHELL: Record<MemberPortraitKey, string> = {
  'woman-adult': 'ring-brand-peach/45',
  'woman-elder': 'ring-brand-sage/50',
  'man-adult': 'ring-brand-aqua/50',
  'man-elder': 'ring-brand-sage/50',
  'girl-child': 'ring-brand-peach/40',
  'girl-teen': 'ring-brand-peach/35',
  'boy-child': 'ring-brand-aqua/40',
  'boy-teen': 'ring-brand-aqua/35',
};

type SexSide = 'female' | 'male' | 'neutral';

function sexFromKinship(kinship: string | null): SexSide | null {
  switch (kinship) {
    case 'mom':
    case 'wife':
    case 'daughter':
    case 'grandma':
      return 'female';
    case 'dad':
    case 'husband':
    case 'son':
    case 'grandpa':
      return 'male';
    default:
      return null;
  }
}

function sexFromProfile(profileSex: ProfileSex): SexSide {
  if (profileSex === 'female') return 'female';
  if (profileSex === 'male') return 'male';
  return 'neutral';
}

function ageBand(member: {
  kinshipLabel: string | null;
  familyRole: FamilyRole | null;
  birthDate: string | null;
}): 'child' | 'teen' | 'adult' | 'elder' {
  const kinship = member.kinshipLabel;
  if (kinship === 'grandma' || kinship === 'grandpa') return 'elder';
  if (kinship === 'son' || kinship === 'daughter') {
    const age = ageFromBirthDate(member.birthDate);
    if (age !== null && age >= 13 && age < 18) return 'teen';
    if (age !== null && age >= 18) return 'adult';
    return 'child';
  }

  const age = ageFromBirthDate(member.birthDate);
  if (age !== null) {
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    if (age >= 60) return 'elder';
    return 'adult';
  }

  if (member.familyRole === 'child') return 'child';
  return 'adult';
}

function portraitFor(sex: SexSide, band: 'child' | 'teen' | 'adult' | 'elder'): MemberPortraitKey {
  if (band === 'elder') {
    return sex === 'male' ? 'man-elder' : 'woman-elder';
  }
  if (band === 'child') {
    if (sex === 'male') return 'boy-child';
    if (sex === 'female') return 'girl-child';
    return 'boy-child';
  }
  if (band === 'teen') {
    if (sex === 'male') return 'boy-teen';
    if (sex === 'female') return 'girl-teen';
    return 'boy-teen';
  }
  return sex === 'male' ? 'man-adult' : 'woman-adult';
}

/**
 * Resolves a branded portrait from kinship → sex → age
 * (Cozi/FamilyWall pattern: role-recognizable member faces without photo uploads).
 */
export function resolveMemberAvatarVisual(member: {
  kinshipLabel: string | null;
  profileSex: ProfileSex;
  familyRole: FamilyRole | null;
  birthDate: string | null;
}): MemberAvatarVisual {
  const sex = sexFromKinship(member.kinshipLabel) ?? sexFromProfile(member.profileSex);
  const band = ageBand(member);
  const portrait = portraitFor(sex, band);
  return {
    portrait,
    imageSrc: PORTRAIT_SRC[portrait],
    shellClass: SHELL[portrait],
  };
}
