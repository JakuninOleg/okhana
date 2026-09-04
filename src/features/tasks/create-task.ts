import { eq } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyTaskAssignees, familyTasks, users } from '@/lib/server/db/schema';

export type CreateTaskInput = {
  familyId: number;
  createdBy: number;
  title: string;
  description?: string;
  dueAt?: Date | null;
  /** Explicit member ids. Ignored when assignToEntireFamily is true. */
  assigneeUserIds?: number[];
  assignToEntireFamily?: boolean;
};

export type CreateTaskResult = {
  taskId: number;
  title: string;
  assigneeUserIds: number[];
  dueAt: string | null;
};

export async function createFamilyTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  const title = input.title.trim();
  if (!title) {
    throw new Error('Task title is required');
  }

  return withDbRetry(async () => {
    const familyMembers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.familyId, input.familyId));

    const memberIds = new Set(familyMembers.map((member) => member.id));
    if (!memberIds.has(input.createdBy)) {
      throw new Error('Creator is not in this family');
    }

    let assigneeUserIds: number[];
    if (input.assignToEntireFamily) {
      assigneeUserIds = [...memberIds];
    } else {
      const requested = [...new Set(input.assigneeUserIds ?? [])];
      if (requested.length === 0) {
        throw new Error('At least one assignee is required');
      }
      const invalid = requested.filter((id) => !memberIds.has(id));
      if (invalid.length > 0) {
        throw new Error(`Assignees not in family: ${invalid.join(', ')}`);
      }
      assigneeUserIds = requested;
    }

    // Parent + assignees must commit together — avoid orphan tasks with no rows.
    const taskId = await db.transaction(async (tx) => {
      const [task] = await tx
        .insert(familyTasks)
        .values({
          familyId: input.familyId,
          title,
          description: input.description?.trim() || null,
          dueAt: input.dueAt ?? null,
          createdBy: input.createdBy,
        })
        .returning({ id: familyTasks.id });

      await tx.insert(familyTaskAssignees).values(
        assigneeUserIds.map((userId) => ({
          taskId: task.id,
          userId,
          status: 'pending' as const,
        })),
      );

      return task.id;
    });

    return {
      taskId,
      title,
      assigneeUserIds,
      dueAt: input.dueAt ? input.dueAt.toISOString() : null,
    };
  });
}
