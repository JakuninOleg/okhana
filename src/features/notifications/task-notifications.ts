import { and, eq } from 'drizzle-orm';
import { sendPushToUsers } from '@/features/notifications/web-push';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyTasks } from '@/lib/server/db/schema';

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

  await sendPushToUsers(recipients, {
    title: 'Okhana',
    body: input.dueAt
      ? `${input.title} · ${new Date(input.dueAt).toISOString()}`
      : input.title,
    url: input.localePath ?? '/dashboard',
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
  const task = await withDbRetry(async () => {
    const [row] = await db
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
    return row ?? null;
  });

  if (!task?.createdBy || task.createdBy === input.completedByUserId) {
    return;
  }

  await sendPushToUsers([task.createdBy], {
    title: 'Okhana',
    body: `✓ ${task.title}`,
    url: input.localePath ?? '/dashboard',
    tag: `task-done-${input.taskId}`,
  });
}
