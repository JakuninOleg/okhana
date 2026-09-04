import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendPushToUsers = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());

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
          limit: vi.fn(() => mockSelectLimit()),
        })),
      })),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  familyTasks: { id: 'id', familyId: 'family_id', title: 'title', createdBy: 'created_by' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
}));

describe('task notifications', () => {
  beforeEach(() => {
    mockSendPushToUsers.mockReset();
    mockSelectLimit.mockReset();
  });

  it('notifyTaskAssigned pushes only to assignees other than the creator', async () => {
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
        title: 'Okhana',
        body: 'Buy milk',
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
    mockSelectLimit.mockResolvedValue([{ title: 'Buy milk', createdBy: 1 }]);
    const { notifyTaskCompleted } = await import('./task-notifications');

    await notifyTaskCompleted({
      familyId: 10,
      taskId: 55,
      completedByUserId: 2,
    });

    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [1],
      expect.objectContaining({
        body: '✓ Buy milk',
        tag: 'task-done-55',
      }),
    );
  });

  it('notifyTaskCompleted does not push when the creator completes their own row', async () => {
    mockSelectLimit.mockResolvedValue([{ title: 'Buy milk', createdBy: 1 }]);
    const { notifyTaskCompleted } = await import('./task-notifications');

    await notifyTaskCompleted({
      familyId: 10,
      taskId: 55,
      completedByUserId: 1,
    });

    expect(mockSendPushToUsers).not.toHaveBeenCalled();
  });
});
