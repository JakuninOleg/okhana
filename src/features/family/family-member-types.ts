export type FamilyRole = 'owner' | 'adult' | 'child';
export type ProfileSex = 'female' | 'male' | 'unspecified';

/** Curated kinship values — UI may also allow free text later. */
export const KINSHIP_OPTIONS = [
  'mom',
  'dad',
  'husband',
  'wife',
  'son',
  'daughter',
  'grandma',
  'grandpa',
  'sibling',
  'other',
] as const;

export type KinshipOption = (typeof KINSHIP_OPTIONS)[number];

export type DashboardFamilyMemberProfile = {
  id: number;
  email: string;
  name: string | null;
  displayName: string | null;
  familyRole: FamilyRole | null;
  kinshipLabel: string | null;
  profileSex: ProfileSex;
  birthDate: string | null;
  profileColor: string | null;
  isCurrentUser: boolean;
};

/** ISO date string YYYY-MM-DD → age in full years, or null if invalid. */
export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const parsed = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDelta = today.getMonth() - parsed.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function memberDisplayLabel(member: {
  displayName: string | null;
  name: string | null;
  email: string;
}): string {
  return member.displayName?.trim()
    || member.name?.trim()
    || member.email.split('@')[0]
    || member.email;
}
