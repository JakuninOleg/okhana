import { and, eq } from 'drizzle-orm';
import { memberDisplayLabel } from '@/features/family/family-member-types';
import { sendPushToUsers } from '@/features/notifications/web-push';
import { routing } from '@/i18n/routing';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyTasks, users } from '@/lib/server/db/schema';

/** Locale-prefixed dashboard path for notification deep links (app has no bare /dashboard). */
export function taskNotificationUrl(localePath?: string): string {
  if (localePath?.startsWith('/')) {
    return localePath;
  }
  return `/${routing.defaultLocale}/dashboard`;
}

async function loadUserLabel(userId: number): Promise<string> {
  const [actor] = await db
    .select({
      displayName: users.displayName,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!actor) return 'Family';
  return memberDisplayLabel(actor);
}

/**
 * Push to assignees when a task is created (excludes the creator).
 * Background phone alerts require an active PWA push subscription + VAPID env.
 */
export async function notifyTaskAssigned(input: {
  title: string;
  createdBy: number;
  assigneeUserIds: number[];
  dueAt: string | null;
  localePath?: string;
}): Promise<void> {
  const recipients = input.assigneeUserIds.filter((id) => id !== input.createdBy);
  if (recipients.length === 0) {
    return;
  }

  const creatorLabel = await withDbRetry(() => loadUserLabel(input.createdBy));
  const dueSuffix = input.dueAt
    ? ` · due ${new Date(input.dueAt).toISOString().slice(0, 16).replace('T', ' ')}`
    : '';

  await sendPushToUsers(recipients, {
    title: 'Okhana · New task',
    body: `${creatorLabel} assigned you: «${input.title}»${dueSuffix}. Mark it seen when you notice it.`,
    url: taskNotificationUrl(input.localePath),
    tag: `task-assigned-${input.title.slice(0, 32)}`,
  });
}

/**
 * Push to the creator when someone else marks their assignment done.
 */
export async function notifyTaskCompleted(input: {
  familyId: number;
  taskId: number;
  completedByUserId: number;
  localePath?: string;
}): Promise<void> {
  const row = await withDbRetry(async () => {
    const [task] = await db
      .select({
        title: familyTasks.title,
        createdBy: familyTasks.createdBy,
      })
      .from(familyTasks)
      .where(and(
        eq(familyTasks.id, input.taskId),
        eq(familyTasks.familyId, input.familyId),
      ))
      .limit(1);

    if (!task?.createdBy || task.createdBy === input.completedByUserId) {
      return null;
    }

    const actorLabel = await loadUserLabel(input.completedByUserId);
    return { title: task.title, createdBy: task.createdBy, actorLabel };
  });

  if (!row) {
    return;
  }

  await sendPushToUsers([row.createdBy], {
    title: 'Okhana · Task done',
    body: `${row.actorLabel} completed the task: «${row.title}»`,
    url: taskNotificationUrl(input.localePath),
    tag: `task-done-${input.taskId}`,
  });
}

/**
 * Push to the creator when an assignee acknowledges (sees / takes on) the task.
 */
export async function notifyTaskAcknowledged(input: {
  familyId: number;
  taskId: number;
  acknowledgedByUserId: number;
  localePath?: string;
}): Promise<void> {
  const row = await withDbRetry(async () => {
    const [task] = await db
      .select({
        title: familyTasks.title,
        createdBy: familyTasks.createdBy,
      })
      .from(familyTasks)
      .where(and(
        eq(familyTasks.id, input.taskId),
        eq(familyTasks.familyId, input.familyId),
      ))
      .limit(1);

    if (!task?.createdBy || task.createdBy === input.acknowledgedByUserId) {
      return null;
    }

    const actorLabel = await loadUserLabel(input.acknowledgedByUserId);
    return { title: task.title, createdBy: task.createdBy, actorLabel };
  });

  if (!row) {
    return;
  }

  await sendPushToUsers([row.createdBy], {
    title: 'Okhana · Task seen',
    body: `${row.actorLabel} saw the task: «${row.title}»`,
    url: taskNotificationUrl(input.localePath),
    tag: `task-ack-${input.taskId}-${input.acknowledgedByUserId}`,
  });
}

/** Reminder: assignee still has not marked the task as seen. */
export async function notifyTaskPendingSeenReminder(input: {
  assigneeUserId: number;
  taskId: number;
  title: string;
  localePath?: string;
}): Promise<void> {
  await sendPushToUsers([input.assigneeUserId], {
    title: 'Okhana · Please mark seen',
    body: `You still have an open task: «${input.title}». Tap Mark seen so the family knows you noticed it.`,
    url: taskNotificationUrl(input.localePath),
    tag: `task-pending-seen-${input.taskId}`,
  });
}

/** Reminder: due date is approaching / today — finish the task. */
export async function notifyTaskDueReminder(input: {
  assigneeUserId: number;
  taskId: number;
  title: string;
  leadPhrase: string;
  localePath?: string;
}): Promise<void> {
  await sendPushToUsers([input.assigneeUserId], {
    title: 'Okhana · Task due',
    body: `${input.leadPhrase}: «${input.title}». Mark it done when finished.`,
    url: taskNotificationUrl(input.localePath),
    tag: `task-due-${input.taskId}-${input.leadPhrase}`,
  });
}
