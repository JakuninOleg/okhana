import { and, eq, gte, isNotNull, lt } from 'drizzle-orm';
import { parseIsoYmdLocal } from '@/lib/format-date';
import { memberDisplayLabel } from '@/features/family/family-member-types';
import {
  calendarYmdInOffset,
  DEFAULT_NUDGE_OFFSET_MINUTES,
  planEventNudges,
  planMemberBirthdayNudges,
  planMemorableDateNudges,
  type PlannedAdvanceNudge,
} from '@/features/notifications/advance-nudge-plan';
import { dashboardNotificationUrl } from '@/features/notifications/family-activity-notifications';
import { sendPushToUsers } from '@/features/notifications/web-push';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import {
  events,
  familyDates,
  families,
  proactiveNudgeDeliveries,
  users,
} from '@/lib/server/db/schema';

export type AdvanceNudgeRunResult = {
  planned: number;
  sent: number;
  skippedDuplicate: number;
  familiesScanned: number;
};

/**
 * Scan all families and send 7/3/1-day advance nudges (Web Push).
 * Idempotent via `proactive_nudge_deliveries.dedupe_key`.
 */
export async function runAdvanceNudges(input?: {
  /** Injected “now” for tests / manual runs. */
  now?: Date;
  offsetMinutes?: number;
}): Promise<AdvanceNudgeRunResult> {
  const offsetMinutes = input?.offsetMinutes ?? DEFAULT_NUDGE_OFFSET_MINUTES;
  const now = input?.now ?? new Date();
  const today = calendarYmdInOffset(now, offsetMinutes);

  const familyRows = await withDbRetry(async () =>
    db.select({ id: families.id }).from(families),
  );

  let planned = 0;
  let sent = 0;
  let skippedDuplicate = 0;

  for (const family of familyRows) {
    const nudges = await collectFamilyNudges(family.id, today, offsetMinutes, now);
    planned += nudges.length;

    if (nudges.length === 0) {
      continue;
    }

    const memberIds = await withDbRetry(async () =>
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.familyId, family.id)),
    );
    const familyRecipientIds = memberIds.map((row) => row.id);
    if (familyRecipientIds.length === 0) {
      continue;
    }

    for (const nudge of nudges) {
      const recipientIds = nudge.recipientUserIds?.length
        ? nudge.recipientUserIds
        : familyRecipientIds;
      if (recipientIds.length === 0) {
        continue;
      }
      const inserted = await tryRecordDelivery(nudge);
      if (!inserted) {
        skippedDuplicate += 1;
        continue;
      }
      try {
        // Claim first (idempotent under concurrent cron), but release if push
        // setup fails so the next daily run can retry this lead window.
        await sendPushToUsers(recipientIds, {
          title: 'Okhana',
          body: nudge.body,
          url: dashboardNotificationUrl(),
          tag: nudge.tag,
        });
        sent += 1;
      } catch (error) {
        await releaseDeliveryClaim(nudge.dedupeKey);
        console.error('[advance-nudges] push failed, claim released', nudge.dedupeKey, error);
      }
    }
  }

  return {
    planned,
    sent,
    skippedDuplicate,
    familiesScanned: familyRows.length,
  };
}

async function collectFamilyNudges(
  familyId: number,
  today: { year: number; month: number; day: number },
  offsetMinutes: number,
  now: Date,
): Promise<PlannedAdvanceNudge[]> {
  const out: PlannedAdvanceNudge[] = [];

  const members = await withDbRetry(async () =>
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        birthDate: users.birthDate,
      })
      .from(users)
      .where(and(eq(users.familyId, familyId), isNotNull(users.birthDate))),
  );

  for (const member of members) {
    if (!member.birthDate) {
      continue;
    }
    const local = parseIsoYmdLocal(member.birthDate);
    if (!local) {
      continue;
    }
    out.push(
      ...planMemberBirthdayNudges({
        familyId,
        userId: member.id,
        displayName: memberDisplayLabel(member),
        birthMonth: local.getMonth() + 1,
        birthDay: local.getDate(),
        today,
      }),
    );
  }

  const dates = await withDbRetry(async () =>
    db
      .select({
        id: familyDates.id,
        title: familyDates.title,
        month: familyDates.month,
        day: familyDates.day,
      })
      .from(familyDates)
      .where(eq(familyDates.familyId, familyId)),
  );

  for (const date of dates) {
    out.push(
      ...planMemorableDateNudges({
        familyId,
        dateId: date.id,
        title: date.title,
        month: date.month,
        day: date.day,
        today,
      }),
    );
  }

  // Look ahead a bit past max lead (7) so DST/edge days still match.
  const from = new Date(now.getTime() - 2 * 86_400_000);
  const to = new Date(now.getTime() + 10 * 86_400_000);
  const eventRows = await withDbRetry(async () =>
    db
      .select({
        id: events.id,
        title: events.title,
        startTime: events.startTime,
        participantUserIds: events.participantUserIds,
      })
      .from(events)
      .where(
        and(
          eq(events.familyId, familyId),
          gte(events.startTime, from),
          lt(events.startTime, to),
        ),
      ),
  );

  for (const event of eventRows) {
    out.push(
      ...planEventNudges({
        familyId,
        eventId: event.id,
        title: event.title,
        startTime: event.startTime,
        today,
        offsetMinutes,
        participantUserIds: event.participantUserIds,
      }),
    );
  }

  return out;
}

/** Insert delivery row; returns false if dedupe key already exists. */
async function tryRecordDelivery(nudge: PlannedAdvanceNudge): Promise<boolean> {
  try {
    await withDbRetry(async () => {
      await db.insert(proactiveNudgeDeliveries).values({
        dedupeKey: nudge.dedupeKey,
        familyId: nudge.familyId,
      });
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }
}

async function releaseDeliveryClaim(dedupeKey: string): Promise<void> {
  await withDbRetry(async () => {
    await db
      .delete(proactiveNudgeDeliveries)
      .where(eq(proactiveNudgeDeliveries.dedupeKey, dedupeKey));
  });
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    if ('code' in current && String(current.code) === '23505') {
      return true;
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}
