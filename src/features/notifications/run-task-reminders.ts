import { and, eq, inArray, isNotNull, isNull, lt, lte } from 'drizzle-orm';
import {
  calendarYmdInOffset,
  daysBetweenYmd,
  DEFAULT_NUDGE_OFFSET_MINUTES,
  ADVANCE_NUDGE_LEAD_DAYS,
  type AdvanceNudgeLeadDays,
} from '@/features/notifications/advance-nudge-plan';
import {
  notifyTaskDueReminder,
  notifyTaskPendingSeenReminder,
} from '@/features/notifications/task-notifications';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import {
  familyTaskAssignees,
  familyTasks,
  proactiveNudgeDeliveries,
} from '@/lib/server/db/schema';

export type TaskReminderRunResult = {
  pendingSeenSent: number;
  dueSent: number;
  skippedDuplicate: number;
};

const PENDING_SEEN_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours

function leadPhrase(leadDays: AdvanceNudgeLeadDays | 0): string {
  if (leadDays === 0) return 'Due today';
  if (leadDays === 1) return 'Due tomorrow';
  if (leadDays === 7) return 'Due in 7 days';
  return `Due in ${leadDays} days`;
}

async function tryClaim(dedupeKey: string, familyId: number): Promise<boolean> {
  try {
    await db.insert(proactiveNudgeDeliveries).values({ dedupeKey, familyId });
    return true;
  } catch {
    return false;
  }
}

async function releaseClaim(dedupeKey: string): Promise<void> {
  await db
    .delete(proactiveNudgeDeliveries)
    .where(eq(proactiveNudgeDeliveries.dedupeKey, dedupeKey));
}

/**
 * Task push reminders:
 * 1) Assignees still `pending` after 2h → “mark seen”
 * 2) Open assignees with dueAt in 7/3/1/0 days → “mark done”
 * Idempotent via proactive_nudge_deliveries.
 */
export async function runTaskReminders(input?: {
  now?: Date;
  offsetMinutes?: number;
}): Promise<TaskReminderRunResult> {
  const now = input?.now ?? new Date();
  const offsetMinutes = input?.offsetMinutes ?? DEFAULT_NUDGE_OFFSET_MINUTES;
  const today = calendarYmdInOffset(now, offsetMinutes);

  let pendingSeenSent = 0;
  let dueSent = 0;
  let skippedDuplicate = 0;

  const pendingCutoff = new Date(now.getTime() - PENDING_SEEN_AFTER_MS);

  const pendingRows = await withDbRetry(async () =>
    db
      .select({
        taskId: familyTasks.id,
        familyId: familyTasks.familyId,
        title: familyTasks.title,
        assigneeUserId: familyTaskAssignees.userId,
      })
      .from(familyTaskAssignees)
      .innerJoin(familyTasks, eq(familyTaskAssignees.taskId, familyTasks.id))
      .where(
        and(
          eq(familyTaskAssignees.status, 'pending'),
          isNull(familyTasks.cancelledAt),
          lt(familyTasks.createdAt, pendingCutoff),
        ),
      ),
  );

  for (const row of pendingRows) {
    const dedupeKey = `task-pending-seen:${row.taskId}:${row.assigneeUserId}`;
    const claimed = await tryClaim(dedupeKey, row.familyId);
    if (!claimed) {
      skippedDuplicate += 1;
      continue;
    }
    try {
      await notifyTaskPendingSeenReminder({
        assigneeUserId: row.assigneeUserId,
        taskId: row.taskId,
        title: row.title,
      });
      pendingSeenSent += 1;
    } catch (error) {
      await releaseClaim(dedupeKey);
      console.error('[task-reminders] pending-seen failed', dedupeKey, error);
    }
  }

  const openAssignees = await withDbRetry(async () =>
    db
      .select({
        taskId: familyTasks.id,
        familyId: familyTasks.familyId,
        title: familyTasks.title,
        dueAt: familyTasks.dueAt,
        assigneeUserId: familyTaskAssignees.userId,
        status: familyTaskAssignees.status,
      })
      .from(familyTaskAssignees)
      .innerJoin(familyTasks, eq(familyTaskAssignees.taskId, familyTasks.id))
      .where(
        and(
          isNull(familyTasks.cancelledAt),
          isNotNull(familyTasks.dueAt),
          inArray(familyTaskAssignees.status, ['pending', 'seen']),
          lte(familyTasks.dueAt, new Date(now.getTime() + 8 * 86_400_000)),
        ),
      ),
  );

  for (const row of openAssignees) {
    if (!row.dueAt) continue;
    const dueYmd = calendarYmdInOffset(row.dueAt, offsetMinutes);
    const days = daysBetweenYmd(today, dueYmd);
    const isLead =
      days === 0
      || (ADVANCE_NUDGE_LEAD_DAYS as readonly number[]).includes(days);
    if (!isLead || days < 0) continue;

    const leadDays = days as AdvanceNudgeLeadDays | 0;
    const dedupeKey = `task-due:${row.taskId}:${row.assigneeUserId}:${days}`;
    const claimed = await tryClaim(dedupeKey, row.familyId);
    if (!claimed) {
      skippedDuplicate += 1;
      continue;
    }
    try {
      await notifyTaskDueReminder({
        assigneeUserId: row.assigneeUserId,
        taskId: row.taskId,
        title: row.title,
        leadPhrase: leadPhrase(leadDays),
      });
      dueSent += 1;
    } catch (error) {
      await releaseClaim(dedupeKey);
      console.error('[task-reminders] due failed', dedupeKey, error);
    }
  }

  return { pendingSeenSent, dueSent, skippedDuplicate };
}
