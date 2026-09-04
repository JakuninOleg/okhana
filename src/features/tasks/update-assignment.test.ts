import { beforeEach, describe, expect, it, vi } from 'vitest';

const selectQueue = vi.hoisted(() => ({
  results: [] as unknown[],
  index: 0,
  reset(next: unknown[]) {
    this.results = next;
    this.index = 0;
  },
  next() {
    const value = this.results[this.index] ?? [];
    this.index += 1;
    return Promise.resolve(value);
  },
}));

const mockUpdateSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => {
      const result = selectQueue.next();
      const builder = {
        from: () => builder,
        where: () => builder,
        limit: () => result,
        then: result.then.bind(result),
        catch: result.catch.bind(result),
      };
      return builder;
    }),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        mockUpdateSet(values);
        return {
          where: (...args: unknown[]) => mockUpdateWhere(...args),
        };
      },
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  familyTasks: { id: 'id', familyId: 'family_id', cancelledAt: 'cancelled_at' },
  familyTaskAssignees: {
    id: 'id',
    taskId: 'task_id',
    userId: 'user_id',
    status: 'status',
    seenAt: 'seen_at',
    doneAt: 'done_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
}));

describe('acknowledgeTaskAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.reset([]);
  });

  async function load() {
    return import('./update-assignment');
  }

  it('returns not found when task is missing in family', async () => {
    selectQueue.reset([[]]);
    const { acknowledgeTaskAssignment } = await load();
    await expect(
      acknowledgeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: false, error: 'Task not found' });
  });

  it('rejects cancelled tasks', async () => {
    selectQueue.reset([[{ id: 9, cancelledAt: new Date() }]]);
    const { acknowledgeTaskAssignment } = await load();
    await expect(
      acknowledgeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: false, error: 'Task is cancelled' });
  });

  it('rejects when the viewer is not an assignee without leaking existence', async () => {
    selectQueue.reset([[{ id: 9, cancelledAt: null }], []]);
    const { acknowledgeTaskAssignment } = await load();
    await expect(
      acknowledgeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: false, error: 'Task not found' });
  });

  it('rejects acknowledge from done or cancelled assignment', async () => {
    selectQueue.reset([
      [{ id: 9, cancelledAt: null }],
      [{ id: 100, status: 'done', seenAt: new Date(), doneAt: new Date() }],
    ]);
    const { acknowledgeTaskAssignment } = await load();
    await expect(
      acknowledgeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({
      ok: false,
      error: 'Cannot acknowledge task in status done',
    });
  });

  it('is idempotent when already seen', async () => {
    selectQueue.reset([
      [{ id: 9, cancelledAt: null }],
      [{ id: 100, status: 'seen', seenAt: new Date(), doneAt: null }],
    ]);
    const { acknowledgeTaskAssignment } = await load();
    await expect(
      acknowledgeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'seen' });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('marks pending assignment as seen', async () => {
    selectQueue.reset([
      [{ id: 9, cancelledAt: null }],
      [{ id: 100, status: 'pending', seenAt: null, doneAt: null }],
    ]);
    mockUpdateWhere.mockResolvedValue(undefined);
    const { acknowledgeTaskAssignment } = await load();

    await expect(
      acknowledgeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'seen' });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'seen', seenAt: expect.any(Date) }),
    );
  });
});

describe('completeTaskAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.reset([]);
  });

  async function load() {
    return import('./update-assignment');
  }

  it('rejects non-assignees without leaking existence', async () => {
    selectQueue.reset([[{ id: 9, cancelledAt: null }], []]);
    const { completeTaskAssignment } = await load();
    await expect(
      completeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: false, error: 'Task not found' });
  });

  it('is idempotent when already done', async () => {
    selectQueue.reset([
      [{ id: 9, cancelledAt: null }],
      [{ id: 100, status: 'done', seenAt: new Date(), doneAt: new Date() }],
    ]);
    const { completeTaskAssignment } = await load();
    await expect(
      completeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'done' });
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('completes from pending and backfills seenAt', async () => {
    selectQueue.reset([
      [{ id: 9, cancelledAt: null }],
      [{ id: 100, status: 'pending', seenAt: null, doneAt: null }],
    ]);
    mockUpdateWhere.mockResolvedValue(undefined);
    const { completeTaskAssignment } = await load();

    await expect(
      completeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'done' });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'done',
        doneAt: expect.any(Date),
        seenAt: expect.any(Date),
      }),
    );
  });

  it('completes from seen and keeps existing seenAt', async () => {
    const seenAt = new Date('2026-09-01T12:00:00.000Z');
    selectQueue.reset([
      [{ id: 9, cancelledAt: null }],
      [{ id: 100, status: 'seen', seenAt, doneAt: null }],
    ]);
    mockUpdateWhere.mockResolvedValue(undefined);
    const { completeTaskAssignment } = await load();

    await expect(
      completeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: true, taskId: 9, status: 'done' });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'done',
        seenAt,
      }),
    );
  });

  it('rejects cancelled assignment', async () => {
    selectQueue.reset([
      [{ id: 9, cancelledAt: null }],
      [{ id: 100, status: 'cancelled', seenAt: null, doneAt: null }],
    ]);
    const { completeTaskAssignment } = await load();
    await expect(
      completeTaskAssignment({ familyId: 1, userId: 2, taskId: 9 }),
    ).resolves.toEqual({ ok: false, error: 'Assignment is cancelled' });
  });
});
