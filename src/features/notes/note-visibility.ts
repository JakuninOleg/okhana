import { arrayContains, eq, isNull, ne, not, or, type SQL } from 'drizzle-orm';
import { notes } from '@/lib/server/db/schema';

export type FamilyRole = 'owner' | 'adult' | 'child';

export type NoteVisibilitySnapshot = {
  privacyLevel: 'public' | 'adults_only' | 'personal';
  createdBy: number | null;
  hiddenFrom: number[] | null;
};

/**
 * Pure ACL mirror of `noteVisibilityConditions` — keep in sync with the SQL below.
 * Used in unit tests so privacy rules stay explicit without hitting the database.
 */
export function noteIsVisibleToViewer(
  note: NoteVisibilitySnapshot,
  viewer: { userId: number; familyRole: FamilyRole },
): boolean {
  if (viewer.familyRole === 'child' && note.privacyLevel === 'adults_only') {
    return false;
  }
  if (note.privacyLevel === 'personal' && note.createdBy !== viewer.userId) {
    return false;
  }
  if (note.hiddenFrom?.includes(viewer.userId)) {
    return false;
  }
  return true;
}

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
