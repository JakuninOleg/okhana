'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  FAMILY_DATE_KINDS,
  isValidMonthDay,
  type FamilyDateRecord,
} from '@/features/family/family-date-utils';
import { createFamilyDate } from '@/features/family/create-family-date';
import { listFamilyDates } from '@/features/family/list-family-dates';
import {
  listMemberBirthdays,
  type MemberBirthdayRecord,
} from '@/features/family/list-member-birthdays';
import { notifyMemorableDateCreated } from '@/features/notifications/family-activity-notifications';
import { calendarYmdFromClientNow } from '@/features/calendar/calendar-time';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyDates } from '@/lib/server/db/schema';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';

export type FamilyDateActionError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'db_unavailable';

// Do not `export type { MemberBirthdayRecord }` from this `'use server'` module:
// Next/SWC can emit a runtime re-export of the erased type →
// ReferenceError: MemberBirthdayRecord is not defined (breaks /dashboard SSR).
// Clients import the type from `@/features/family/list-member-birthdays`.

const createSchema = z.object({
  title: z.string().trim().min(1).max(255),
  kind: z.enum(FAMILY_DATE_KINDS),
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
  year: z.union([z.coerce.number().int().min(1900).max(2100), z.literal('')]).optional(),
  notes: z.string().trim().max(2000).optional(),
});

async function loadActor(clerkUserId: string) {
  const actor = await ensureDbUser(clerkUserId);
  if (!actor?.familyId || !actor.familyRole) {
    return null;
  }
  return {
    userId: actor.id,
    familyId: actor.familyId,
    familyRole: actor.familyRole,
  };
}

function canManageDates(role: string): boolean {
  return role === 'owner' || role === 'adult';
}

export async function loadFamilyDatesAction(input?: {
  clientNow?: string;
}): Promise<
  {
    ok: true;
    dates: FamilyDateRecord[];
    memberBirthdays: MemberBirthdayRecord[];
    canManage: boolean;
  }
  | { ok: false; error: FamilyDateActionError }
> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor) {
      return { ok: false, error: 'forbidden' };
    }
    const today = calendarYmdFromClientNow(input?.clientNow ?? null) ?? undefined;
    const [dates, memberBirthdays] = await Promise.all([
      listFamilyDates(actor.familyId, today ? { today } : undefined),
      listMemberBirthdays(actor.familyId, today ? { today } : undefined),
    ]);
    return {
      ok: true,
      dates,
      memberBirthdays,
      canManage: canManageDates(actor.familyRole),
    };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}

export async function createFamilyDateAction(
  input: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: number } | { ok: false; error: FamilyDateActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success || !isValidMonthDay(parsed.data.month, parsed.data.day)) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor) {
      return { ok: false, error: 'forbidden' };
    }
    if (!canManageDates(actor.familyRole)) {
      return { ok: false, error: 'forbidden' };
    }

    const yearValue = parsed.data.year === '' || parsed.data.year === undefined
      ? null
      : parsed.data.year;

    const created = await createFamilyDate({
      familyId: actor.familyId,
      createdBy: actor.userId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      month: parsed.data.month,
      day: parsed.data.day,
      year: yearValue,
      notes: parsed.data.notes?.length ? parsed.data.notes : null,
    });

    void notifyMemorableDateCreated({
      familyId: actor.familyId,
      createdBy: actor.userId,
      dateId: created.id,
      dateTitle: parsed.data.title,
    });

    revalidatePath('/[locale]/dashboard', 'page');
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}

export async function deleteFamilyDateAction(
  dateId: number,
): Promise<{ ok: true } | { ok: false; error: FamilyDateActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  if (!Number.isInteger(dateId) || dateId < 1) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor) {
      return { ok: false, error: 'forbidden' };
    }
    if (!canManageDates(actor.familyRole)) {
      return { ok: false, error: 'forbidden' };
    }

    const deleted = await withDbRetry(async () =>
      db
        .delete(familyDates)
        .where(and(
          eq(familyDates.id, dateId),
          eq(familyDates.familyId, actor.familyId),
        ))
        .returning({ id: familyDates.id }),
    );

    if (!deleted[0]) {
      return { ok: false, error: 'not_found' };
    }

    revalidatePath('/[locale]/dashboard', 'page');
    return { ok: true };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}
