import { isValidMonthDay, type FamilyDateKind } from '@/features/family/family-date-utils';
import { loadActiveFamilyMember } from '@/lib/server/family/assert-family-member';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyDates } from '@/lib/server/db/schema';

export type CreateFamilyDateInput = {
  familyId: number;
  createdBy: number;
  title: string;
  kind: FamilyDateKind;
  month: number;
  day: number;
  year?: number | null;
  notes?: string | null;
};

export type CreatedFamilyDate = {
  id: number;
  title: string;
  kind: FamilyDateKind;
  month: number;
  day: number;
  year: number | null;
};

/** Persist a recurring memorable date (anniversary, birthday, …). */
export async function createFamilyDate(
  input: CreateFamilyDateInput,
): Promise<CreatedFamilyDate> {
  if (!isValidMonthDay(input.month, input.day)) {
    throw new Error('Invalid month/day for memorable date');
  }

  const member = await loadActiveFamilyMember(input.createdBy, input.familyId);
  if (!member) {
    throw new Error('Creator is not in this family');
  }

  const [row] = await withDbRetry(async () =>
    db
      .insert(familyDates)
      .values({
        familyId: member.familyId,
        title: input.title,
        kind: input.kind,
        month: input.month,
        day: input.day,
        year: input.year ?? null,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        createdBy: input.createdBy,
      })
      .returning({
        id: familyDates.id,
        title: familyDates.title,
        kind: familyDates.kind,
        month: familyDates.month,
        day: familyDates.day,
        year: familyDates.year,
      }),
  );

  return row;
}
