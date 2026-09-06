import { eq } from 'drizzle-orm';
import {
  nextOccurrenceIso,
  type CalendarYmd,
} from '@/features/family/family-date-utils';
import { memberDisplayLabel } from '@/features/family/family-member-types';
import { parseIsoYmdLocal } from '@/lib/format-date';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';

export type MemberBirthdayRecord = {
  userId: number;
  displayName: string;
  month: number;
  day: number;
  year: number | null;
  nextOccurrence: string;
};

export async function listMemberBirthdays(
  familyId: number,
  options?: { today?: CalendarYmd },
): Promise<MemberBirthdayRecord[]> {
  const rows = await withDbRetry(async () =>
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        // Drizzle `date()` columns are ISO `YYYY-MM-DD` strings (not Date objects).
        birthDate: users.birthDate,
      })
      .from(users)
      .where(eq(users.familyId, familyId)),
  );

  const today = options?.today ?? {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
  };

  const birthdays: MemberBirthdayRecord[] = [];
  for (const row of rows) {
    if (!row.birthDate) {
      continue;
    }
    const local = parseIsoYmdLocal(row.birthDate);
    if (!local) {
      continue;
    }
    const month = local.getMonth() + 1;
    const day = local.getDate();
    birthdays.push({
      userId: row.id,
      displayName: memberDisplayLabel(row),
      month,
      day,
      year: local.getFullYear(),
      nextOccurrence: nextOccurrenceIso(month, day, today),
    });
  }

  return birthdays;
}
