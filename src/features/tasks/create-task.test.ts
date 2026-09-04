import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockInsertValues = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...args: unknown[]) => mockSelectWhere(...args),
      })),
    })),
    transaction: vi.fn(async (callback: (tx: {
      insert: typeof mockTxInsert;
    }) => Promise<number>) => callback({ insert: mockTxInsert })),
  },
}));

const mockTxInsert = vi.hoisted(() =>
  vi.fn(() => ({
    values: (values: unknown) => {
      mockInsertValues(values);
      return {
        returning: () => mockInsertReturning(),
      };
    },
  })),
);

vi.mock('@/lib/server/db/schema', () => ({
  users: { id: 'id', familyId: 'family_id' },
  familyTasks: { id: 'id' },
  familyTaskAssignees: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}));

describe('createFamilyTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function load() {
    return import('./create-task');
  }

  it('rejects empty title without querying', async () => {
    const { createFamilyTask } = await load();
    await expect(
      createFamilyTask({
        familyId: 1,
        createdBy: 2,
        title: '   ',
        assigneeUserIds: [2],
      }),
    ).rejects.toThrow('Task title is required');
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });

  it('rejects when creator is not in the family', async () => {
    mockSelectWhere.mockResolvedValue([{ id: 3 }, { id: 4 }]);
    const { createFamilyTask } = await load();

    await expect(
      createFamilyTask({
        familyId: 1,
        createdBy: 2,
        title: 'Buy milk',
        assigneeUserIds: [3],
      }),
    ).rejects.toThrow('Creator is not in this family');
  });

  it('rejects assignees outside the family', async () => {
    mockSelectWhere.mockResolvedValue([{ id: 2 }, { id: 3 }]);
    const { createFamilyTask } = await load();

    await expect(
      createFamilyTask({
        familyId: 1,
        createdBy: 2,
        title: 'Buy milk',
        assigneeUserIds: [3, 99],
      }),
    ).rejects.toThrow('Assignees not in family: 99');
  });

  it('rejects empty assignee list when not entire family', async () => {
    mockSelectWhere.mockResolvedValue([{ id: 2 }, { id: 3 }]);
    const { createFamilyTask } = await load();

    await expect(
      createFamilyTask({
        familyId: 1,
        createdBy: 2,
        title: 'Buy milk',
        assigneeUserIds: [],
      }),
    ).rejects.toThrow('At least one assignee is required');
  });

  it('creates a task for explicit assignees and dedupes ids', async () => {
    mockSelectWhere.mockResolvedValue([{ id: 2 }, { id: 3 }, { id: 4 }]);
    mockInsertReturning.mockResolvedValue([{ id: 50 }]);
    const { createFamilyTask } = await load();

    const dueAt = new Date('2026-09-05T15:00:00.000Z');
    await expect(
      createFamilyTask({
        familyId: 1,
        createdBy: 2,
        title: '  Buy milk  ',
        description: '  2L  ',
        dueAt,
        assigneeUserIds: [3, 3, 4],
      }),
    ).resolves.toEqual({
      taskId: 50,
      title: 'Buy milk',
      assigneeUserIds: [3, 4],
      dueAt: dueAt.toISOString(),
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 1,
        title: 'Buy milk',
        description: '2L',
        createdBy: 2,
        dueAt,
      }),
    );
    expect(mockInsertValues).toHaveBeenCalledWith([
      { taskId: 50, userId: 3, status: 'pending' },
      { taskId: 50, userId: 4, status: 'pending' },
    ]);
  });

  it('assigns every family member when assignToEntireFamily is true', async () => {
    mockSelectWhere.mockResolvedValue([{ id: 2 }, { id: 3 }, { id: 4 }]);
    mockInsertReturning.mockResolvedValue([{ id: 51 }]);
    const { createFamilyTask } = await load();

    const result = await createFamilyTask({
      familyId: 1,
      createdBy: 2,
      title: 'Family cleanup',
      assignToEntireFamily: true,
      assigneeUserIds: [99],
    });

    expect(result.assigneeUserIds.sort()).toEqual([2, 3, 4]);
    expect(mockInsertValues).toHaveBeenCalledWith([
      { taskId: 51, userId: 2, status: 'pending' },
      { taskId: 51, userId: 3, status: 'pending' },
      { taskId: 51, userId: 4, status: 'pending' },
    ]);
  });
});
