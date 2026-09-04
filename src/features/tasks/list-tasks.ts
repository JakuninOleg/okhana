import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { familyTaskAssignees, familyTasks } from '@/lib/server/db/schema';

export type TaskAssigneeView = {
  userId: number;
  status: 'pending' | 'seen' | 'done' | 'cancelled';
  seenAt: string | null;
  doneAt: string | null;
};

export type VisibleTask = {
  id: number;
  title: string;
  description: string | null;
  dueAt: string | null;
  createdBy: number | null;
  createdAt: string;
  cancelledAt: string | null;
  /** True when the viewer created this task. */
  isCreator: boolean;
  /** Viewer's own assignee row, if they are assigned. */
  myAssignment: TaskAssigneeView | null;
  assignees: TaskAssigneeView[];
};

export type ListVisibleTasksInput = {
  familyId: number;
  userId: number;
  /** active = open for viewer; completed = done for viewer / all-done for creator-only. */
  scope?: 'active' | 'completed' | 'all';
};

export type TaskListScope = NonNullable<ListVisibleTasksInput['scope']>;

/**
 * Pure post-query filter (ACL already applied by the SQL). Exported for unit tests.
 */
export function filterTasksByScope(
  tasks: VisibleTask[],
  scope: TaskListScope,
): VisibleTask[] {
  if (scope === 'all') {
    return tasks;
  }

  if (scope === 'completed') {
    return tasks.filter((task) => {
      if (task.cancelledAt) return false;
      if (task.myAssignment) {
        return task.myAssignment.status === 'done';
      }
      // Creator-only view: completed when every assignee is done
      return (
        task.assignees.length > 0
        && task.assignees.every((a) => a.status === 'done')
      );
    });
  }

  // active
  return tasks.filter((task) => {
    if (task.cancelledAt) return false;
    if (task.myAssignment) {
      return task.myAssignment.status === 'pending' || task.myAssignment.status === 'seen';
    }
    return task.assignees.some((a) => a.status === 'pending' || a.status === 'seen');
  });
}

export function mapTaskRowsToVisible(input: {
  userId: number;
  taskRows: Array<{
    id: number;
    title: string;
    description: string | null;
    dueAt: Date | null;
    createdBy: number | null;
    createdAt: Date;
    cancelledAt: Date | null;
  }>;
  assignees: Array<{
    taskId: number;
    userId: number;
    status: TaskAssigneeView['status'];
    seenAt: Date | null;
    doneAt: Date | null;
  }>;
}): VisibleTask[] {
  const byTask = new Map<number, TaskAssigneeView[]>();
  for (const row of input.assignees) {
    const list = byTask.get(row.taskId) ?? [];
    list.push({
      userId: row.userId,
      status: row.status,
      seenAt: row.seenAt?.toISOString() ?? null,
      doneAt: row.doneAt?.toISOString() ?? null,
    });
    byTask.set(row.taskId, list);
  }

  return input.taskRows.map((row) => {
    const taskAssignees = byTask.get(row.id) ?? [];
    const myAssignment = taskAssignees.find((a) => a.userId === input.userId) ?? null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      dueAt: row.dueAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      isCreator: row.createdBy === input.userId,
      myAssignment,
      assignees: taskAssignees,
    };
  });
}

/**
 * Privacy at query level: only tasks where the user is creator OR assignee.
 */
export async function listVisibleTasks(input: ListVisibleTasksInput): Promise<VisibleTask[]> {
  const scope = input.scope ?? 'active';

  return withDbRetry(async () => {
    const assignedTaskIds = db
      .select({ taskId: familyTaskAssignees.taskId })
      .from(familyTaskAssignees)
      .where(eq(familyTaskAssignees.userId, input.userId));

    const taskRows = await db
      .select({
        id: familyTasks.id,
        title: familyTasks.title,
        description: familyTasks.description,
        dueAt: familyTasks.dueAt,
        createdBy: familyTasks.createdBy,
        createdAt: familyTasks.createdAt,
        cancelledAt: familyTasks.cancelledAt,
      })
      .from(familyTasks)
      .where(
        and(
          eq(familyTasks.familyId, input.familyId),
          or(
            eq(familyTasks.createdBy, input.userId),
            inArray(familyTasks.id, assignedTaskIds),
          ),
        ),
      )
      .orderBy(desc(familyTasks.createdAt));

    if (taskRows.length === 0) {
      return [];
    }

    const assignees = await db
      .select({
        taskId: familyTaskAssignees.taskId,
        userId: familyTaskAssignees.userId,
        status: familyTaskAssignees.status,
        seenAt: familyTaskAssignees.seenAt,
        doneAt: familyTaskAssignees.doneAt,
      })
      .from(familyTaskAssignees)
      .where(inArray(familyTaskAssignees.taskId, taskRows.map((row) => row.id)));

    return filterTasksByScope(
      mapTaskRowsToVisible({
        userId: input.userId,
        taskRows,
        assignees,
      }),
      scope,
    );
  });
}
