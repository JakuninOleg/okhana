import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db', () => ({
  db: {
    transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  aiUsageFamilyDaily: {
    familyId: 'family_id',
    usageDate: 'usage_date',
    chatCount: 'chat_count',
  },
  aiUsageUserDaily: {
    userId: 'user_id',
    usageDate: 'usage_date',
    chatCount: 'chat_count',
    familyId: 'family_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: (...args: unknown[]) => args,
}));

describe('consumeDailyChatQuota', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_CHAT_DISABLED;
    delete process.env.AI_CHAT_DAILY_FAMILY_LIMIT;
    delete process.env.AI_CHAT_DAILY_USER_LIMIT;
  });

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it('returns disabled when kill-switch is on', async () => {
    process.env.AI_CHAT_DISABLED = 'true';
    const { consumeDailyChatQuota } = await import('./ai-usage-quota');
    await expect(
      consumeDailyChatQuota({ familyId: 1, userId: 2 }),
    ).resolves.toMatchObject({ ok: false, reason: 'disabled' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('increments family and user counters when under limits', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: {
      insert: () => {
        values: () => {
          onConflictDoUpdate: () => {
            returning: () => Promise<Array<{ chatCount: number }>>;
          };
        };
      };
    }) => Promise<unknown>) => {
      let calls = 0;
      const tx = {
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: () => ({
              returning: async () => {
                calls += 1;
                return [{ chatCount: calls === 1 ? 12 : 5 }];
              },
            }),
          }),
        }),
      };
      return fn(tx);
    });

    const { consumeDailyChatQuota } = await import('./ai-usage-quota');
    await expect(
      consumeDailyChatQuota({
        familyId: 1,
        userId: 2,
        now: new Date('2026-09-07T12:00:00+03:00'),
      }),
    ).resolves.toEqual({
      ok: true,
      usageDate: '2026-09-07',
      familyCount: 12,
      userCount: 5,
      familyLimit: 150,
      userLimit: 80,
    });
  });

  it('returns family_daily_limit when family upsert returns no row', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: {
      insert: () => {
        values: () => {
          onConflictDoUpdate: () => {
            returning: () => Promise<Array<{ chatCount: number }>>;
          };
        };
      };
    }) => Promise<unknown>) => {
      const tx = {
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: () => ({
              returning: async () => [],
            }),
          }),
        }),
      };
      return fn(tx);
    });

    const { consumeDailyChatQuota } = await import('./ai-usage-quota');
    await expect(
      consumeDailyChatQuota({ familyId: 1, userId: 2 }),
    ).resolves.toMatchObject({ ok: false, reason: 'family_daily_limit' });
  });

  it('returns user_daily_limit and rolls back via thrown marker', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: {
      insert: () => {
        values: () => {
          onConflictDoUpdate: () => {
            returning: () => Promise<Array<{ chatCount: number }>>;
          };
        };
      };
    }) => Promise<unknown>) => {
      let calls = 0;
      const tx = {
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: () => ({
              returning: async () => {
                calls += 1;
                if (calls === 1) return [{ chatCount: 10 }];
                return [];
              },
            }),
          }),
        }),
      };
      return fn(tx);
    });

    const { consumeDailyChatQuota } = await import('./ai-usage-quota');
    await expect(
      consumeDailyChatQuota({ familyId: 1, userId: 2 }),
    ).resolves.toMatchObject({ ok: false, reason: 'user_daily_limit' });
  });
});
