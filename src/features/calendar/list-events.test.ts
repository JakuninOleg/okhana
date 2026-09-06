import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockDeleteWhere = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: (...args: unknown[]) => mockInsertReturning(...args),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
          limit: (...args: unknown[]) => mockSelectLimit(...args),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: (...args: unknown[]) => mockDeleteWhere(...args),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  events: {
    id: 'id',
    familyId: 'family_id',
    title: 'title',
    description: 'description',
    startTime: 'start_time',
    endTime: 'end_time',
    allDay: 'all_day',
    createdBy: 'created_by',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((value: unknown) => value),
  eq: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
  lte: vi.fn((...args: unknown[]) => args),
}));

describe('calendar list-events helpers', () => {
  beforeEach(() => {
    mockInsertReturning.mockReset();
    mockSelectLimit.mockReset();
    mockDeleteWhere.mockReset();
  });

  it('createFamilyEvent inserts and returns id', async () => {
    mockInsertReturning.mockResolvedValue([{ id: 77 }]);
    const { createFamilyEvent } = await import('./list-events');
    await expect(
      createFamilyEvent({
        familyId: 1,
        createdBy: 2,
        title: 'Dentist',
        startTime: new Date('2026-09-10T10:00:00Z'),
      }),
    ).resolves.toEqual({ id: 77 });
  });

  it('deleteFamilyEvent forbids children deleting others events', async () => {
    mockSelectLimit.mockResolvedValue([{ id: 5, createdBy: 1 }]);
    const { deleteFamilyEvent } = await import('./list-events');
    await expect(
      deleteFamilyEvent({
        familyId: 1,
        userId: 4,
        familyRole: 'child',
        eventId: 5,
      }),
    ).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it('deleteFamilyEvent allows author child to delete own event', async () => {
    mockSelectLimit.mockResolvedValue([{ id: 5, createdBy: 4 }]);
    mockDeleteWhere.mockResolvedValue(undefined);
    const { deleteFamilyEvent } = await import('./list-events');
    await expect(
      deleteFamilyEvent({
        familyId: 1,
        userId: 4,
        familyRole: 'child',
        eventId: 5,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('deleteFamilyEvent returns not_found for missing rows', async () => {
    mockSelectLimit.mockResolvedValue([]);
    const { deleteFamilyEvent } = await import('./list-events');
    await expect(
      deleteFamilyEvent({
        familyId: 1,
        userId: 2,
        familyRole: 'owner',
        eventId: 99,
      }),
    ).resolves.toEqual({ ok: false, error: 'not_found' });
  });
});
