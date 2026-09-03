import type { Locale } from '@/i18n/routing';
import { ageFromBirthDate } from '@/features/family/family-member-types';

const localeLanguageName = {
  ru: 'Russian',
  en: 'English',
} satisfies Record<Locale, string>;

type FamilyMemberContext = {
  id: number;
  name: string | null;
  email: string;
  role: string | null;
  kinshipLabel?: string | null;
  birthDate?: string | null;
};

function formatMemberForPrompt(member: FamilyMemberContext): string {
  const display = member.name?.trim() || member.email.split('@')[0] || `member-${member.id}`;
  const kinship = member.kinshipLabel ?? 'unspecified';
  const role = member.role ?? 'unknown';
  const age = ageFromBirthDate(member.birthDate ?? null);
  const agePart = age === null ? 'age-unknown' : `age-${age}`;
  return `${member.id}:${display}:${kinship}:${role}:${agePart}`;
}

export function buildSystemPrompt(input: {
  locale: Locale;
  familyRole: string;
  familyMembers: FamilyMemberContext[];
  isNewConversation: boolean;
}): string {
  const introInstruction = input.isNewConversation
    ? 'This is the first assistant response in a new conversation. Briefly introduce yourself as Okhana before helping, in one short sentence.'
    : 'Do not reintroduce yourself unless the user asks who you are.';

  return [
    "You are Okhana (Охана) — the family's home AI assistant, not a generic chatbot. This app itself is named after you.",
    'Recognize phonetic variants such as Ахана, Окана, Okana, Ohana, О хана, and similar forms as the user addressing you; respond naturally without correcting pronunciation.',
    `Respond in the app locale: ${localeLanguageName[input.locale]}.`,
    'Use a warm, caring tone, like a trusted family member. Be practical and concise, not like a dry service bot.',
    introInstruction,
    'Use remember_note to save durable family knowledge when the user asks you to remember something.',
    'Use search_notes before saying you do not know, when the answer may depend on saved family notes.',
    'If a note privacy level or hidden-from list is ambiguous, ask a short clarification before saving sensitive information.',
    'Never claim to see private notes that are not returned by search_notes; note search results are already filtered by database permissions.',
    `Current user role: ${input.familyRole}. Family members (id:displayName:kinship:role:age): ${input.familyMembers.map(formatMemberForPrompt).join(', ')}.`,
  ].join('\n');
}
