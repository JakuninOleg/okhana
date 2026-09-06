import { asc, eq } from 'drizzle-orm';
import {
  daysUntilNextOccurrence,
  nextOccurrenceIso,
  type CalendarYmd,
  type FamilyDateKind,
  type FamilyDateRecord,
} from '@/features/family/family-date-utils';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyDates } from '@/lib/server/db/schema';

export async function listFamilyDates(
  familyId: number,
  options?: { today?: CalendarYmd },
): Promise<FamilyDateRecord[]> {
  const rows = await withDbRetry(async () =>
    db
      .select({
        id: familyDates.id,
        title: familyDates.title,
        kind: familyDates.kind,
        month: familyDates.month,
        day: familyDates.day,
        year: familyDates.year,
        notes: familyDates.notes,
      })
      .from(familyDates)
      .where(eq(familyDates.familyId, familyId))
      .orderBy(asc(familyDates.month), asc(familyDates.day)),
  );

  const today = options?.today ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  };

  return rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind as FamilyDateKind,
      month: row.month,
      day: row.day,
      year: row.year,
      notes: row.notes,
      nextOccurrence: nextOccurrenceIso(row.month, row.day, today),
    }))
    .sort(
      (a, b) =>
        daysUntilNextOccurrence(a.month, a.day, today)
        - daysUntilNextOccurrence(b.month, b.day, today),
    );
}
