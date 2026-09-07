import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInsertReturning = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/family/assert-family-member', () => ({
  loadActiveFamilyMember: vi.fn(async (userId: number, familyId?: number) => ({
    userId,
    clerkId: 'user_test',
    familyId: familyId ?? 1,
    familyRole: 'adult' as const,
  })),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((payload: unknown) => {
        (globalThis as { __lastFamilyDateInsert?: unknown }).__lastFamilyDateInsert = payload;
        return {
          returning: (...args: unknown[]) => mockInsertReturning(...args),
        };
      }),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  familyDates: {
    id: 'id',
    title: 'title',
    kind: 'kind',
    month: 'month',
    day: 'day',
    year: 'year',
  },
}));

describe('createFamilyDate', () => {
  beforeEach(() => {
    mockInsertReturning.mockReset();
    delete (globalThis as { __lastFamilyDateInsert?: unknown }).__lastFamilyDateInsert;
  });

  it('rejects invalid month/day before insert', async () => {
    const { createFamilyDate } = await import('./create-family-date');
    await expect(
      createFamilyDate({
        familyId: 1,
        createdBy: 2,
        title: 'Bad',
        kind: 'other',
        month: 2,
        day: 31,
      }),
    ).rejects.toThrow(/Invalid month\/day/);
    expect(mockInsertReturning).not.toHaveBeenCalled();
  });

  it('inserts anniversary with trimmed notes', async () => {
    mockInsertReturning.mockResolvedValue([
      {
        id: 3,
        title: 'Годовщина свадьбы',
        kind: 'anniversary',
        month: 6,
        day: 21,
        year: 2023,
      },
    ]);

    const { createFamilyDate } = await import('./create-family-date');
    await expect(
      createFamilyDate({
        familyId: 1,
        createdBy: 2,
        title: 'Годовщина свадьбы',
        kind: 'anniversary',
        month: 6,
        day: 21,
        year: 2023,
        notes: '  together  ',
      }),
    ).resolves.toEqual({
      id: 3,
      title: 'Годовщина свадьбы',
      kind: 'anniversary',
      month: 6,
      day: 21,
      year: 2023,
    });

    expect((globalThis as { __lastFamilyDateInsert?: unknown }).__lastFamilyDateInsert).toEqual(
      expect.objectContaining({
        familyId: 1,
        createdBy: 2,
        notes: 'together',
        year: 2023,
      }),
    );
  });
});
