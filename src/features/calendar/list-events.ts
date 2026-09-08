import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { loadActiveFamilyMember } from '@/lib/server/family/assert-family-member';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { events } from '@/lib/server/db/schema';

export type FamilyEventRecord = {
  id: number;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  allDay: boolean;
  createdBy: number | null;
  participantUserIds: number[] | null;
};

type ListEventsInRangeInput = {
  familyId: number;
  from: Date;
  to: Date;
  limit?: number;
};

export async function listEventsInRange(
  input: ListEventsInRangeInput,
): Promise<FamilyEventRecord[]> {
  const maxResults = Math.min(Math.max(input.limit ?? 50, 1), 100);

  return withDbRetry(async () => db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startTime: events.startTime,
      endTime: events.endTime,
      allDay: events.allDay,
      createdBy: events.createdBy,
      participantUserIds: events.participantUserIds,
    })
    .from(events)
    .where(
      and(
        eq(events.familyId, input.familyId),
        gte(events.startTime, input.from),
        lte(events.startTime, input.to),
      ),
    )
    .orderBy(asc(events.startTime))
    .limit(maxResults));
}

type CreateEventInput = {
  familyId: number;
  createdBy: number;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date | null;
  allDay?: boolean;
  /** Who the event is addressed to — targeted push when set. */
  participantUserIds?: number[];
};

export async function createFamilyEvent(
  input: CreateEventInput,
): Promise<{ id: number; participantUserIds: number[] }> {
  const member = await loadActiveFamilyMember(input.createdBy, input.familyId);
  if (!member) {
    throw new Error('Creator is not in this family');
  }

  const participants = [...new Set((input.participantUserIds ?? []).filter((id) => id > 0))];

  if (participants.length > 0) {
    const { assertUsersShareFamily } = await import('@/lib/server/family/assert-family-member');
    const ok = await assertUsersShareFamily(participants, member.familyId);
    if (!ok) {
      throw new Error('Participants must be in the same family');
    }
  }

  return withDbRetry(async () => {
    const [row] = await db
      .insert(events)
      .values({
        familyId: member.familyId,
        createdBy: input.createdBy,
        title: input.title,
        description: input.description?.trim() || null,
        startTime: input.startTime,
        endTime: input.endTime ?? null,
        allDay: input.allDay ?? false,
        participantUserIds: participants.length > 0 ? participants : null,
      })
      .returning({ id: events.id });

    if (!row) {
      throw new Error('Failed to create event');
    }
    return { id: row.id, participantUserIds: participants };
  });
}

type DeleteEventInput = {
  familyId: number;
  userId: number;
  familyRole: 'owner' | 'adult' | 'child';
  eventId: number;
};

export async function deleteFamilyEvent(
  input: DeleteEventInput,
): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'forbidden' }> {
  return withDbRetry(async () => {
    const [row] = await db
      .select({
        id: events.id,
        createdBy: events.createdBy,
      })
      .from(events)
      .where(and(eq(events.id, input.eventId), eq(events.familyId, input.familyId)))
      .limit(1);

    if (!row) {
      return { ok: false, error: 'not_found' };
    }

    const isOwnerOrAdult = input.familyRole === 'owner' || input.familyRole === 'adult';
    const isAuthor = row.createdBy === input.userId;
    if (!isOwnerOrAdult && !isAuthor) {
      return { ok: false, error: 'forbidden' };
    }

    await db
      .delete(events)
      .where(and(eq(events.id, input.eventId), eq(events.familyId, input.familyId)));

    return { ok: true };
  });
}
