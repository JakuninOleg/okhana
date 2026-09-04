import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyTaskAssignees, familyTasks } from '@/lib/server/db/schema';

export type UpdateAssignmentResult =
  | { ok: true; taskId: number; status: 'seen' | 'done' }
  | { ok: false; error: string };

/** Same message for missing / inaccessible tasks — avoid leaking assignment existence. */
const NOT_FOUND = 'Task not found';

/**
 * Assignee marks the task as seen (ack). Creator who is not assigned cannot ack.
 */
export async function acknowledgeTaskAssignment(input: {
  familyId: number;
  userId: number;
  taskId: number;
}): Promise<UpdateAssignmentResult> {
  return withDbRetry(async () => {
    const [task] = await db
      .select({ id: familyTasks.id, cancelledAt: familyTasks.cancelledAt })
      .from(familyTasks)
      .where(and(eq(familyTasks.id, input.taskId), eq(familyTasks.familyId, input.familyId)))
      .limit(1);

    if (!task) {
      return { ok: false, error: NOT_FOUND };
    }
    if (task.cancelledAt) {
      return { ok: false, error: 'Task is cancelled' };
    }

    const [assignment] = await db
      .select()
      .from(familyTaskAssignees)
      .where(
        and(
          eq(familyTaskAssignees.taskId, input.taskId),
          eq(familyTaskAssignees.userId, input.userId),
        ),
      )
      .limit(1);

    if (!assignment) {
      return { ok: false, error: NOT_FOUND };
    }
    if (assignment.status === 'done' || assignment.status === 'cancelled') {
      return { ok: false, error: `Cannot acknowledge task in status ${assignment.status}` };
    }
    if (assignment.status === 'seen') {
      return { ok: true, taskId: input.taskId, status: 'seen' };
    }

    const now = new Date();
    await db
      .update(familyTaskAssignees)
      .set({ status: 'seen', seenAt: now })
      .where(eq(familyTaskAssignees.id, assignment.id));

    return { ok: true, taskId: input.taskId, status: 'seen' };
  });
}

/**
 * Per-assignee completion — does not force other assignees to done.
 */
export async function completeTaskAssignment(input: {
  familyId: number;
  userId: number;
  taskId: number;
}): Promise<UpdateAssignmentResult> {
  return withDbRetry(async () => {
    const [task] = await db
      .select({ id: familyTasks.id, cancelledAt: familyTasks.cancelledAt })
      .from(familyTasks)
      .where(and(eq(familyTasks.id, input.taskId), eq(familyTasks.familyId, input.familyId)))
      .limit(1);

    if (!task) {
      return { ok: false, error: NOT_FOUND };
    }
    if (task.cancelledAt) {
      return { ok: false, error: 'Task is cancelled' };
    }

    const [assignment] = await db
      .select()
      .from(familyTaskAssignees)
      .where(
        and(
          eq(familyTaskAssignees.taskId, input.taskId),
          eq(familyTaskAssignees.userId, input.userId),
        ),
      )
      .limit(1);

    if (!assignment) {
      return { ok: false, error: NOT_FOUND };
    }
    if (assignment.status === 'cancelled') {
      return { ok: false, error: 'Assignment is cancelled' };
    }
    if (assignment.status === 'done') {
      return { ok: true, taskId: input.taskId, status: 'done' };
    }

    const now = new Date();
    await db
      .update(familyTaskAssignees)
      .set({
        status: 'done',
        doneAt: now,
        seenAt: assignment.seenAt ?? now,
      })
      .where(eq(familyTaskAssignees.id, assignment.id));

    return { ok: true, taskId: input.taskId, status: 'done' };
  });
}
