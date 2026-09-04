'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { listVisibleTasks, type VisibleTask } from '@/features/tasks/list-tasks';
import {
  acknowledgeTaskAssignment,
  completeTaskAssignment,
} from '@/features/tasks/update-assignment';
import { notifyTaskCompleted } from '@/features/notifications/task-notifications';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';

export type TaskActionErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'cancelled'
  | 'ack_blocked'
  | 'complete_blocked'
  | 'generic';

async function requireFamilyUser(): Promise<{ familyId: number; userId: number } | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return null;
  }

  return withDbRetry(async () => {
    const [dbUser] = await db
      .select({ id: users.id, familyId: users.familyId })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (!dbUser?.familyId) {
      return null;
    }
    return { familyId: dbUser.familyId, userId: dbUser.id };
  });
}

function mapAssignmentError(message: string): TaskActionErrorCode {
  if (message === 'Task not found') return 'not_found';
  if (message === 'Task is cancelled') return 'cancelled';
  if (message === 'Assignment is cancelled') return 'complete_blocked';
  if (message.startsWith('Cannot acknowledge')) return 'ack_blocked';
  return 'generic';
}

export async function loadMyTasksAction(
  scope: 'active' | 'completed' = 'active',
): Promise<{ ok: true; tasks: VisibleTask[] } | { ok: false; error: TaskActionErrorCode }> {
  const ctx = await requireFamilyUser();
  if (!ctx) {
    return { ok: false, error: 'unauthorized' };
  }

  const tasks = await listVisibleTasks({
    familyId: ctx.familyId,
    userId: ctx.userId,
    scope,
  });
  return { ok: true, tasks };
}

export async function acknowledgeTaskAction(
  taskId: number,
): Promise<{ ok: true; status: 'seen' } | { ok: false; error: TaskActionErrorCode }> {
  const ctx = await requireFamilyUser();
  if (!ctx) {
    return { ok: false, error: 'unauthorized' };
  }

  const result = await acknowledgeTaskAssignment({
    familyId: ctx.familyId,
    userId: ctx.userId,
    taskId,
  });
  if (!result.ok) {
    return { ok: false, error: mapAssignmentError(result.error) };
  }
  return { ok: true, status: 'seen' };
}

export async function completeTaskAction(
  taskId: number,
): Promise<{ ok: true; status: 'done' } | { ok: false; error: TaskActionErrorCode }> {
  const ctx = await requireFamilyUser();
  if (!ctx) {
    return { ok: false, error: 'unauthorized' };
  }

  const result = await completeTaskAssignment({
    familyId: ctx.familyId,
    userId: ctx.userId,
    taskId,
  });
  if (!result.ok) {
    return { ok: false, error: mapAssignmentError(result.error) };
  }
  void notifyTaskCompleted({
    familyId: ctx.familyId,
    taskId,
    completedByUserId: ctx.userId,
  });
  return { ok: true, status: 'done' };
}
