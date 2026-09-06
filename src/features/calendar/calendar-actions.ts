'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createFamilyEvent,
  deleteFamilyEvent,
  listEventsInRange,
  type FamilyEventRecord,
} from '@/features/calendar/list-events';
import {
  buildMonthVisibleRange,
  calendarYmdFromClientNow,
  parseAbsoluteDateTime,
} from '@/features/calendar/calendar-time';
import { listFamilyDates } from '@/features/family/list-family-dates';
import {
  listMemberBirthdays,
  type MemberBirthdayRecord,
} from '@/features/family/list-member-birthdays';
import type { FamilyDateRecord } from '@/features/family/family-date-utils';
import { notifyEventCreated } from '@/features/notifications/family-activity-notifications';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';

export type CalendarActionError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'not_found'
  | 'db_unavailable';

async function loadActor(clerkUserId: string) {
  const actor = await ensureDbUser(clerkUserId);
  if (!actor?.familyId || !actor.familyRole) {
    return null;
  }
  return {
    userId: actor.id,
    familyId: actor.familyId,
    familyRole: actor.familyRole as 'owner' | 'adult' | 'child',
  };
}

function canManage(role: string): boolean {
  return role === 'owner' || role === 'adult';
}

function resolveMonth(input?: {
  clientNow?: string;
  year?: number;
  month?: number;
}): { year: number; month: number } {
  if (
    typeof input?.year === 'number'
    && typeof input?.month === 'number'
    && Number.isInteger(input.year)
    && input.month >= 1
    && input.month <= 12
  ) {
    return { year: input.year, month: input.month };
  }
  const fromClient = calendarYmdFromClientNow(input?.clientNow ?? null);
  if (fromClient) {
    return { year: fromClient.year, month: fromClient.month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export async function loadFamilyCalendarAction(input?: {
  /** Device-local ISO with offset — anchors “today” + month TZ. */
  clientNow?: string;
  /** Calendar year for the visible month grid. */
  year?: number;
  /** Calendar month 1–12 for the visible month grid. */
  month?: number;
}): Promise<
  {
    ok: true;
    events: FamilyEventRecord[];
    dates: FamilyDateRecord[];
    memberBirthdays: MemberBirthdayRecord[];
    canManage: boolean;
    year: number;
    month: number;
  }
  | { ok: false; error: CalendarActionError }
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

    const { year, month } = resolveMonth(input);
    const { from, to } = buildMonthVisibleRange({
      year,
      month,
      padDays: 7,
      clientNowIso: input?.clientNow ?? null,
    });
    const today = calendarYmdFromClientNow(input?.clientNow ?? null) ?? undefined;

    const [eventRows, dates, memberBirthdays] = await Promise.all([
      listEventsInRange({ familyId: actor.familyId, from, to, limit: 100 }),
      listFamilyDates(actor.familyId, today ? { today } : undefined),
      listMemberBirthdays(actor.familyId, today ? { today } : undefined),
    ]);

    return {
      ok: true,
      events: eventRows,
      dates,
      memberBirthdays,
      canManage: canManage(actor.familyRole),
      year,
      month,
    };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  /** Local datetime string from `<input type="datetime-local">` or ISO. */
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().optional().or(z.literal('')),
  allDay: z.boolean().optional(),
});

function parseClientDate(value: string): Date | null {
  return parseAbsoluteDateTime(value);
}

export async function createCalendarEventAction(
  input: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: number } | { ok: false; error: CalendarActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor || !canManage(actor.familyRole)) {
      return { ok: false, error: 'forbidden' };
    }

    const startTime = parseClientDate(parsed.data.startTime);
    if (!startTime) {
      return { ok: false, error: 'invalid_input' };
    }

    let endTime: Date | null = null;
    if (parsed.data.endTime && parsed.data.endTime !== '') {
      endTime = parseClientDate(parsed.data.endTime);
      if (!endTime) {
        return { ok: false, error: 'invalid_input' };
      }
    }

    const created = await createFamilyEvent({
      familyId: actor.familyId,
      createdBy: actor.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      startTime,
      endTime,
      allDay: parsed.data.allDay ?? false,
    });

    void notifyEventCreated({
      familyId: actor.familyId,
      createdBy: actor.userId,
      eventId: created.id,
      eventTitle: parsed.data.title,
    });

    revalidatePath('/[locale]/dashboard', 'page');
    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}

const deleteSchema = z.object({
  eventId: z.coerce.number().int().positive(),
});

export async function deleteCalendarEventAction(
  input: z.infer<typeof deleteSchema>,
): Promise<{ ok: true } | { ok: false; error: CalendarActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor) {
      return { ok: false, error: 'forbidden' };
    }

    const result = await deleteFamilyEvent({
      familyId: actor.familyId,
      userId: actor.userId,
      familyRole: actor.familyRole,
      eventId: parsed.data.eventId,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    revalidatePath('/[locale]/dashboard', 'page');
    return { ok: true };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}
