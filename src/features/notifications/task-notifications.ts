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
  if (!actor) return 'Кто-то из семьи';
  return memberDisplayLabel(actor);
}

function formatDueRu(dueAt: string): string {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}`;
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
  const dueSuffix = input.dueAt ? ` · срок ${formatDueRu(input.dueAt)}` : '';

  await sendPushToUsers(recipients, {
    title: 'Новое поручение',
    body: `${creatorLabel} поручил вам: «${input.title}»${dueSuffix}. Отметьте «Видел», когда заметите.`,
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
    title: 'Поручение выполнено',
    body: `${row.actorLabel} выполнил(а): «${row.title}»`,
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
    title: 'Поручение просмотрено',
    body: `${row.actorLabel} увидел(а): «${row.title}»`,
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
    title: 'Отметьте поручение',
    body: `Вы ещё не отметили «${input.title}». Нажмите «Видел», чтобы семья знала.`,
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
    title: 'Срок поручения',
    body: `${input.leadPhrase}: «${input.title}». Отметьте «Сделано», когда выполните.`,
    url: taskNotificationUrl(input.localePath),
    tag: `task-due-${input.taskId}-${input.leadPhrase}`,
  });
}
