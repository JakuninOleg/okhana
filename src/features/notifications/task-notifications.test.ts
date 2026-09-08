import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendPushToUsers = vi.hoisted(() => vi.fn());
const selectQueue = vi.hoisted(() => {
  const rows: unknown[][] = [];
  return {
    reset(next: unknown[][]) {
      rows.length = 0;
      rows.push(...next);
    },
    next() {
      return rows.shift() ?? [];
    },
  };
});

vi.mock('@/features/notifications/web-push', () => ({
  sendPushToUsers: (...args: unknown[]) => mockSendPushToUsers(...args),
}));

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(selectQueue.next())),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  familyTasks: { id: 'id', familyId: 'family_id', title: 'title', createdBy: 'created_by' },
  users: { id: 'id', displayName: 'display_name', name: 'name', email: 'email' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
}));

describe('task notifications', () => {
  beforeEach(() => {
    mockSendPushToUsers.mockReset();
    selectQueue.reset([]);
  });

  it('notifyTaskAssigned pushes only to assignees other than the creator', async () => {
    selectQueue.reset([
      [{ displayName: 'Oleg', name: null, email: 'oleg@example.com' }],
    ]);
    const { notifyTaskAssigned } = await import('./task-notifications');

    await notifyTaskAssigned({
      title: 'Buy milk',
      createdBy: 1,
      assigneeUserIds: [1, 2, 3],
      dueAt: null,
    });

    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [2, 3],
      expect.objectContaining({
        title: 'Okhana · New task',
        body: 'Oleg assigned you: «Buy milk». Mark it seen when you notice it.',
        url: '/ru/dashboard',
        tag: expect.stringContaining('task-assigned'),
      }),
    );
  });

  it('notifyTaskAssigned no-ops when only the creator is assigned', async () => {
    const { notifyTaskAssigned } = await import('./task-notifications');

    await notifyTaskAssigned({
      title: 'Self reminder',
      createdBy: 1,
      assigneeUserIds: [1],
      dueAt: null,
    });

    expect(mockSendPushToUsers).not.toHaveBeenCalled();
  });

  it('notifyTaskCompleted pushes the creator when someone else finishes', async () => {
    selectQueue.reset([[{ title: 'Buy milk', createdBy: 1 }]]);
    const { notifyTaskCompleted } = await import('./task-notifications');

    await notifyTaskCompleted({
      familyId: 10,
      taskId: 55,
      completedByUserId: 2,
    });

    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [1],
      expect.objectContaining({
        body: 'Family completed the task: «Buy milk»',
        url: '/ru/dashboard',
        tag: 'task-done-55',
      }),
    );
  });

  it('notifyTaskCompleted does not push when the creator completes their own row', async () => {
    selectQueue.reset([[{ title: 'Buy milk', createdBy: 1 }]]);
    const { notifyTaskCompleted } = await import('./task-notifications');

    await notifyTaskCompleted({
      familyId: 10,
      taskId: 55,
      completedByUserId: 1,
    });

    expect(mockSendPushToUsers).not.toHaveBeenCalled();
  });

  it('notifyTaskAcknowledged pushes the creator with the assignee label', async () => {
    selectQueue.reset([
      [{ title: 'Buy milk', createdBy: 1 }],
      [{ displayName: 'Masha', email: 'masha@example.com' }],
    ]);
    const { notifyTaskAcknowledged } = await import('./task-notifications');

    await notifyTaskAcknowledged({
      familyId: 10,
      taskId: 55,
      acknowledgedByUserId: 2,
    });

    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [1],
      expect.objectContaining({
        body: 'Masha saw the task: «Buy milk»',
        url: '/ru/dashboard',
        tag: 'task-ack-55-2',
      }),
    );
  });

  it('notifyTaskAcknowledged does not push when the creator acks their own row', async () => {
    selectQueue.reset([[{ title: 'Buy milk', createdBy: 1 }]]);
    const { notifyTaskAcknowledged } = await import('./task-notifications');

    await notifyTaskAcknowledged({
      familyId: 10,
      taskId: 55,
      acknowledgedByUserId: 1,
    });

    expect(mockSendPushToUsers).not.toHaveBeenCalled();
  });
});
