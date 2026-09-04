import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockEnsureDbUser = vi.hoisted(() => vi.fn());
const mockListFamilyDates = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockDeleteReturning = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/server/users/ensure-db-user', () => ({
  ensureDbUser: (...args: unknown[]) => mockEnsureDbUser(...args),
}));

vi.mock('@/features/family/list-family-dates', () => ({
  listFamilyDates: (...args: unknown[]) => mockListFamilyDates(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

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
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: (...args: unknown[]) => mockDeleteReturning(...args),
      })),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  familyDates: {
    id: 'id',
    familyId: 'family_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((...args: unknown[]) => args),
}));

describe('family date actions', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockEnsureDbUser.mockReset();
    mockListFamilyDates.mockReset();
    mockInsertReturning.mockReset();
    mockDeleteReturning.mockReset();
    mockRevalidatePath.mockReset();
  });

  it('loadFamilyDatesAction returns dates for family members', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'adult' });
    mockListFamilyDates.mockResolvedValue([
      {
        id: 1,
        title: 'Wedding',
        kind: 'anniversary',
        month: 6,
        day: 15,
        year: 2018,
        notes: null,
        nextOccurrence: '2027-06-15',
      },
    ]);

    const { loadFamilyDatesAction } = await import('./date-actions');
    await expect(loadFamilyDatesAction()).resolves.toEqual({
      ok: true,
      canManage: true,
      dates: [
        expect.objectContaining({ title: 'Wedding', kind: 'anniversary' }),
      ],
    });
  });

  it('createFamilyDateAction rejects children', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'child' });

    const { createFamilyDateAction } = await import('./date-actions');
    await expect(
      createFamilyDateAction({
        title: 'Wedding',
        kind: 'anniversary',
        month: 6,
        day: 15,
      }),
    ).resolves.toEqual({ ok: false, error: 'forbidden' });
  });

  it('createFamilyDateAction inserts a valid recurring date', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'owner' });
    mockInsertReturning.mockResolvedValue([{ id: 44 }]);

    const { createFamilyDateAction } = await import('./date-actions');
    await expect(
      createFamilyDateAction({
        title: 'Wedding',
        kind: 'anniversary',
        month: 6,
        day: 15,
        year: 2018,
        notes: 'Together',
      }),
    ).resolves.toEqual({ ok: true, id: 44 });
    expect(mockRevalidatePath).toHaveBeenCalled();
  });

  it('deleteFamilyDateAction scopes delete to the actor family', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'adult' });
    mockDeleteReturning.mockResolvedValue([{ id: 7 }]);

    const { deleteFamilyDateAction } = await import('./date-actions');
    await expect(deleteFamilyDateAction(7)).resolves.toEqual({ ok: true });
  });
});
