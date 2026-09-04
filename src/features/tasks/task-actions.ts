'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { listVisibleTasks, type VisibleTask } from '@/features/tasks/list-tasks';
import {
  acknowledgeTaskAssignment,
  completeTaskAssignment,
} from '@/features/tasks/update-assignment';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';

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

export async function loadMyTasksAction(
  scope: 'active' | 'completed' = 'active',
): Promise<{ ok: true; tasks: VisibleTask[] } | { ok: false; error: string }> {
  const ctx = await requireFamilyUser();
  if (!ctx) {
    return { ok: false, error: 'Unauthorized' };
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
): Promise<{ ok: true; status: 'seen' } | { ok: false; error: string }> {
  const ctx = await requireFamilyUser();
  if (!ctx) {
    return { ok: false, error: 'Unauthorized' };
  }

  const result = await acknowledgeTaskAssignment({
    familyId: ctx.familyId,
    userId: ctx.userId,
    taskId,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, status: 'seen' };
}

export async function completeTaskAction(
  taskId: number,
): Promise<{ ok: true; status: 'done' } | { ok: false; error: string }> {
  const ctx = await requireFamilyUser();
  if (!ctx) {
    return { ok: false, error: 'Unauthorized' };
  }

  const result = await completeTaskAssignment({
    familyId: ctx.familyId,
    userId: ctx.userId,
    taskId,
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, status: 'done' };
}
