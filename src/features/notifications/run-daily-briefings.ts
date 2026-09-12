import { and, eq, gte, lt } from 'drizzle-orm';
import { parseIsoYmdLocal } from '@/lib/format-date';
import { memberDisplayLabel } from '@/features/family/family-member-types';
import {
  calendarYmdInOffset,
  DEFAULT_NUDGE_OFFSET_MINUTES,
} from '@/features/notifications/advance-nudge-plan';
import {
  briefingDedupeKey,
  buildBriefingPushContent,
  formatEventBriefingLine,
  formatRecurringBriefingLine,
  type BriefingSlot,
} from '@/features/notifications/daily-briefing-plan';
import { dashboardNotificationUrl } from '@/features/notifications/family-activity-notifications';
import { sendPushToUsers } from '@/features/notifications/web-push';
import { listVisibleTasks } from '@/features/tasks/list-tasks';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import {
  events,
  familyDates,
  families,
  proactiveNudgeDeliveries,
  users,
} from '@/lib/server/db/schema';

export type DailyBriefingRunResult = {
  slot: BriefingSlot;
  planned: number;
  sent: number;
  skippedDuplicate: number;
  skippedEmpty: number;
  membersScanned: number;
};

/**
 * Per-member morning/evening digest via Web Push.
 * Idempotent: one push per user per slot per Moscow calendar day.
 */
export async function runDailyBriefings(input: {
  slot: BriefingSlot;
  now?: Date;
  offsetMinutes?: number;
}): Promise<DailyBriefingRunResult> {
  const offsetMinutes = input.offsetMinutes ?? DEFAULT_NUDGE_OFFSET_MINUTES;
  const now = input.now ?? new Date();
  const today = calendarYmdInOffset(now, offsetMinutes);

  const familyRows = await withDbRetry(async () =>
    db.select({ id: families.id }).from(families),
  );

  let planned = 0;
  let sent = 0;
  let skippedDuplicate = 0;
  let skippedEmpty = 0;
  let membersScanned = 0;

  const from = new Date(now.getTime() - 1 * 86_400_000);
  const to = new Date(now.getTime() + 3 * 86_400_000);

  for (const family of familyRows) {
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
        .where(eq(users.familyId, family.id)),
    );

    const dates = await withDbRetry(async () =>
      db
        .select({
          title: familyDates.title,
          month: familyDates.month,
          day: familyDates.day,
        })
        .from(familyDates)
        .where(eq(familyDates.familyId, family.id)),
    );

    const eventRows = await withDbRetry(async () =>
      db
        .select({
          title: events.title,
          startTime: events.startTime,
        })
        .from(events)
        .where(
          and(
            eq(events.familyId, family.id),
            gte(events.startTime, from),
            lt(events.startTime, to),
          ),
        ),
    );

    const eventLines = eventRows
      .map((event) =>
        formatEventBriefingLine({
          title: event.title,
          startTime: event.startTime,
          today,
          offsetMinutes,
        }),
      )
      .filter((line): line is string => Boolean(line));

    const memorableLines = dates
      .map((date) =>
        formatRecurringBriefingLine({
          label: date.title,
          month: date.month,
          day: date.day,
          today,
        }),
      )
      .filter((line): line is string => Boolean(line));

    const birthdayEntries: Array<{ userId: number; line: string }> = [];
    for (const member of members) {
      if (!member.birthDate) {
        continue;
      }
      const local = parseIsoYmdLocal(member.birthDate);
      if (!local) {
        continue;
      }
      const line = formatRecurringBriefingLine({
        label: `ДР ${memberDisplayLabel(member)}`,
        month: local.getMonth() + 1,
        day: local.getDate(),
        today,
      });
      if (line) {
        birthdayEntries.push({ userId: member.id, line });
      }
    }

    for (const member of members) {
      membersScanned += 1;

      const activeTasks = await listVisibleTasks({
        familyId: family.id,
        userId: member.id,
        scope: 'active',
      });
      const openTaskTitles = activeTasks
        .filter((task) => task.myAssignment !== null)
        .map((task) => task.title);

      // Never remind someone about their own birthday in the daily briefing.
      const birthdayLines = birthdayEntries
        .filter((entry) => entry.userId !== member.id)
        .map((entry) => entry.line);

      const content = buildBriefingPushContent({
        slot: input.slot,
        openTaskTitles,
        eventLines,
        dateLines: [...memorableLines, ...birthdayLines],
      });

      if (!content) {
        skippedEmpty += 1;
        continue;
      }

      planned += 1;
      const dedupeKey = briefingDedupeKey({
        slot: input.slot,
        userId: member.id,
        today,
      });

      const claimed = await tryRecordDelivery({
        dedupeKey,
        familyId: family.id,
      });
      if (!claimed) {
        skippedDuplicate += 1;
        continue;
      }

      try {
        await sendPushToUsers([member.id], {
          title: content.title,
          body: content.body,
          url: dashboardNotificationUrl(),
          tag: dedupeKey,
        });
        sent += 1;
      } catch (error) {
        await releaseDeliveryClaim(dedupeKey);
        console.error('[daily-briefing] push failed, claim released', dedupeKey, error);
      }
    }
  }

  return {
    slot: input.slot,
    planned,
    sent,
    skippedDuplicate,
    skippedEmpty,
    membersScanned,
  };
}

async function tryRecordDelivery(input: {
  dedupeKey: string;
  familyId: number;
}): Promise<boolean> {
  try {
    await withDbRetry(async () => {
      await db.insert(proactiveNudgeDeliveries).values({
        dedupeKey: input.dedupeKey,
        familyId: input.familyId,
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
