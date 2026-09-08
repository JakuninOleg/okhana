import { beforeEach, describe, expect, it, vi } from 'vitest';

const selectLimit = vi.hoisted(() => vi.fn());
const updateWhere = vi.hoisted(() => vi.fn());
const updateReturning = vi.hoisted(() => vi.fn());
const txUpdateWhere = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: (...args: unknown[]) => selectLimit(...args),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: (...args: unknown[]) => {
          updateWhere(...args);
          return {
            returning: (...retArgs: unknown[]) => updateReturning(...retArgs),
          };
        },
      })),
    })),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  familyTasks: {
    id: 'id',
    familyId: 'family_id',
    createdBy: 'created_by',
    cancelledAt: 'cancelled_at',
    title: 'title',
    dueAt: 'due_at',
  },
  familyTaskAssignees: {
    taskId: 'task_id',
    status: 'status',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn((col: unknown) => col),
}));

describe('manage-task', () => {
  beforeEach(() => {
    selectLimit.mockReset();
    updateWhere.mockReset();
    updateReturning.mockReset();
    txUpdateWhere.mockReset();
    mockTransaction.mockReset();
    mockTransaction.mockImplementation(async (fn: (tx: {
      update: () => {
        set: () => { where: (...args: unknown[]) => unknown };
      };
    }) => Promise<unknown>) => {
      const tx = {
        update: () => ({
          set: () => ({
            where: (...args: unknown[]) => txUpdateWhere(...args),
          }),
        }),
      };
      return fn(tx);
    });
  });

  it('updateFamilyTask allows the creator to change title and dueAt', async () => {
    selectLimit.mockResolvedValue([{ id: 9, createdBy: 2, cancelledAt: null }]);
    updateReturning.mockResolvedValue([{
      id: 9,
      title: 'Buy bread',
      dueAt: new Date('2026-09-10T12:00:00.000Z'),
    }]);
    const { updateFamilyTask } = await import('./manage-task');

    await expect(updateFamilyTask({
      familyId: 1,
      userId: 2,
      familyRole: 'child',
      taskId: 9,
      title: 'Buy bread',
      dueAt: new Date('2026-09-10T12:00:00.000Z'),
    })).resolves.toEqual({
      ok: true,
      taskId: 9,
      title: 'Buy bread',
      dueAt: '2026-09-10T12:00:00.000Z',
    });
  });

  it('updateFamilyTask rejects non-creator children as not_found', async () => {
    selectLimit.mockResolvedValue([{ id: 9, createdBy: 3, cancelledAt: null }]);
    const { updateFamilyTask } = await import('./manage-task');

    await expect(updateFamilyTask({
      familyId: 1,
      userId: 2,
      familyRole: 'child',
      taskId: 9,
      title: 'Nope',
    })).resolves.toEqual({ ok: false, error: 'not_found' });
  });

  it('cancelFamilyTask soft-cancels for owner/adult', async () => {
    selectLimit.mockResolvedValue([{ id: 9, createdBy: 3, cancelledAt: null }]);
    const { cancelFamilyTask } = await import('./manage-task');

    await expect(cancelFamilyTask({
      familyId: 1,
      userId: 2,
      familyRole: 'owner',
      taskId: 9,
    })).resolves.toEqual({ ok: true, taskId: 9 });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(txUpdateWhere).toHaveBeenCalledTimes(2);
  });

  it('cancelFamilyTask is idempotent for authorized callers', async () => {
    selectLimit.mockResolvedValue([{
      id: 9,
      createdBy: 2,
      cancelledAt: new Date('2026-09-01T00:00:00.000Z'),
    }]);
    const { cancelFamilyTask } = await import('./manage-task');

    await expect(cancelFamilyTask({
      familyId: 1,
      userId: 2,
      familyRole: 'adult',
      taskId: 9,
    })).resolves.toEqual({ ok: true, taskId: 9 });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('cancelFamilyTask hides cancelled tasks from unauthorized callers', async () => {
    selectLimit.mockResolvedValue([{
      id: 9,
      createdBy: 3,
      cancelledAt: new Date('2026-09-01T00:00:00.000Z'),
    }]);
    const { cancelFamilyTask } = await import('./manage-task');

    await expect(cancelFamilyTask({
      familyId: 1,
      userId: 2,
      familyRole: 'child',
      taskId: 9,
    })).resolves.toEqual({ ok: false, error: 'not_found' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
