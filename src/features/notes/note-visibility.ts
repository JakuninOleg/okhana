import { arrayContains, eq, isNull, ne, not, or, type SQL } from 'drizzle-orm';
import { notes } from '@/lib/server/db/schema';

export type FamilyRole = 'owner' | 'adult' | 'child';

/**
 * DB-level note visibility for the asking user.
 * Never rely on the model to withhold notes — filter here before any AI context.
 */
export function noteVisibilityConditions(input: {
  userId: number;
  familyRole: FamilyRole;
}): SQL[] {
  const conditions: SQL[] = [];

  if (input.familyRole === 'child') {
    conditions.push(ne(notes.privacyLevel, 'adults_only'));
  }

  conditions.push(
    or(ne(notes.privacyLevel, 'personal'), eq(notes.createdBy, input.userId))!,
  );
  conditions.push(
    or(isNull(notes.hiddenFrom), not(arrayContains(notes.hiddenFrom, [input.userId])))!,
  );

  return conditions;
}
