import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyTaskAssignees, familyTasks } from '@/lib/server/db/schema';

type FamilyRole = 'owner' | 'adult' | 'child';

export type ManageTaskError = 'not_found' | 'cancelled' | 'invalid_input';

/** Same code for missing / inaccessible — avoid leaking task existence. */
const NOT_FOUND = 'not_found' as const;

type LoadedTask = {
  id: number;
  createdBy: number | null;
  cancelledAt: Date | null;
};

async function loadFamilyTask(input: {
  familyId: number;
  taskId: number;
}): Promise<LoadedTask | null> {
  const [task] = await db
    .select({
      id: familyTasks.id,
      createdBy: familyTasks.createdBy,
      cancelledAt: familyTasks.cancelledAt,
    })
    .from(familyTasks)
    .where(and(eq(familyTasks.id, input.taskId), eq(familyTasks.familyId, input.familyId)))
    .limit(1);
  return task ?? null;
}

function canManageTask(input: {
  familyRole: FamilyRole;
  userId: number;
  createdBy: number | null;
}): boolean {
  if (input.createdBy === input.userId) {
    return true;
  }
  return input.familyRole === 'owner' || input.familyRole === 'adult';
}

export type UpdateFamilyTaskInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  taskId: number;
  title?: string;
  description?: string | null;
  dueAt?: Date | null;
};

/**
 * Creator or owner/adult may edit title / description / due date on a live task.
 */
export async function updateFamilyTask(
  input: UpdateFamilyTaskInput,
): Promise<
  | { ok: true; taskId: number; title: string; dueAt: string | null }
  | { ok: false; error: ManageTaskError }
> {
  const patch: {
    title?: string;
    description?: string | null;
    dueAt?: Date | null;
  } = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title || title.length > 255) {
      return { ok: false, error: 'invalid_input' };
    }
    patch.title = title;
  }
  if (input.description !== undefined) {
    const description = input.description?.trim() || null;
    if (description && description.length > 2000) {
      return { ok: false, error: 'invalid_input' };
    }
    patch.description = description;
  }
  if (input.dueAt !== undefined) {
    patch.dueAt = input.dueAt;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'invalid_input' };
  }

  return withDbRetry(async () => {
    const task = await loadFamilyTask({
      familyId: input.familyId,
      taskId: input.taskId,
    });
    if (!task || !canManageTask({
      familyRole: input.familyRole,
      userId: input.userId,
      createdBy: task.createdBy,
    })) {
      return { ok: false, error: NOT_FOUND };
    }
    if (task.cancelledAt) {
      return { ok: false, error: 'cancelled' };
    }

    const [updated] = await db
      .update(familyTasks)
      .set(patch)
      .where(and(
        eq(familyTasks.id, input.taskId),
        eq(familyTasks.familyId, input.familyId),
        isNull(familyTasks.cancelledAt),
      ))
      .returning({
        id: familyTasks.id,
        title: familyTasks.title,
        dueAt: familyTasks.dueAt,
      });

    if (!updated) {
      return { ok: false, error: NOT_FOUND };
    }

    return {
      ok: true,
      taskId: updated.id,
      title: updated.title,
      dueAt: updated.dueAt ? updated.dueAt.toISOString() : null,
    };
  });
}

export type CancelFamilyTaskInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  taskId: number;
};

/**
 * Soft-cancel a task (sets cancelledAt) and marks open assignee rows cancelled.
 * Creator or owner/adult only. Unauthorized callers always get not_found.
 */
export async function cancelFamilyTask(
  input: CancelFamilyTaskInput,
): Promise<{ ok: true; taskId: number } | { ok: false; error: ManageTaskError }> {
  return withDbRetry(async () => {
    const task = await loadFamilyTask({
      familyId: input.familyId,
      taskId: input.taskId,
    });
    if (!task || !canManageTask({
      familyRole: input.familyRole,
      userId: input.userId,
      createdBy: task.createdBy,
    })) {
      return { ok: false, error: NOT_FOUND };
    }
    if (task.cancelledAt) {
      return { ok: true, taskId: task.id };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(familyTasks)
        .set({ cancelledAt: now })
        .where(and(
          eq(familyTasks.id, input.taskId),
          eq(familyTasks.familyId, input.familyId),
          isNull(familyTasks.cancelledAt),
        ));
      // Keep done rows for history; cancel only open assignments.
      await tx
        .update(familyTaskAssignees)
        .set({ status: 'cancelled' })
        .where(and(
          eq(familyTaskAssignees.taskId, input.taskId),
          inArray(familyTaskAssignees.status, ['pending', 'seen']),
        ));
    });

    return { ok: true, taskId: input.taskId };
  });
}
