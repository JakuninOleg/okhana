import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockListVisibleTasks = vi.hoisted(() => vi.fn());
const mockAcknowledge = vi.hoisted(() => vi.fn());
const mockComplete = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
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
  users: { id: 'id', clerkId: 'clerk_id', familyId: 'family_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('@/features/tasks/list-tasks', () => ({
  listVisibleTasks: (...args: unknown[]) => mockListVisibleTasks(...args),
}));

vi.mock('@/features/tasks/update-assignment', () => ({
  acknowledgeTaskAssignment: (...args: unknown[]) => mockAcknowledge(...args),
  completeTaskAssignment: (...args: unknown[]) => mockComplete(...args),
}));

describe('task-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function load() {
    return import('./task-actions');
  }

  it('loadMyTasksAction returns Unauthorized without Clerk session', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { loadMyTasksAction } = await load();
    await expect(loadMyTasksAction('active')).resolves.toEqual({
      ok: false,
      error: 'Unauthorized',
    });
  });

  it('loadMyTasksAction returns Unauthorized when user has no family', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockSelectLimit.mockResolvedValue([{ id: 2, familyId: null }]);
    const { loadMyTasksAction } = await load();
    await expect(loadMyTasksAction()).resolves.toEqual({
      ok: false,
      error: 'Unauthorized',
    });
  });

  it('loadMyTasksAction returns visible tasks for the family member', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockSelectLimit.mockResolvedValue([{ id: 2, familyId: 7 }]);
    mockListVisibleTasks.mockResolvedValue([{ id: 1, title: 'Milk' }]);
    const { loadMyTasksAction } = await load();

    await expect(loadMyTasksAction('completed')).resolves.toEqual({
      ok: true,
      tasks: [{ id: 1, title: 'Milk' }],
    });
    expect(mockListVisibleTasks).toHaveBeenCalledWith({
      familyId: 7,
      userId: 2,
      scope: 'completed',
    });
  });

  it('acknowledgeTaskAction forwards to assignment update', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockSelectLimit.mockResolvedValue([{ id: 2, familyId: 7 }]);
    mockAcknowledge.mockResolvedValue({ ok: true, taskId: 9, status: 'seen' });
    const { acknowledgeTaskAction } = await load();

    await expect(acknowledgeTaskAction(9)).resolves.toEqual({ ok: true, status: 'seen' });
    expect(mockAcknowledge).toHaveBeenCalledWith({
      familyId: 7,
      userId: 2,
      taskId: 9,
    });
  });

  it('completeTaskAction surfaces assignment errors', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockSelectLimit.mockResolvedValue([{ id: 2, familyId: 7 }]);
    mockComplete.mockResolvedValue({
      ok: false,
      error: 'Task not found',
    });
    const { completeTaskAction } = await load();

    await expect(completeTaskAction(9)).resolves.toEqual({
      ok: false,
      error: 'Task not found',
    });
  });
});
