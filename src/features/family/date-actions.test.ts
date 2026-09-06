import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockEnsureDbUser = vi.hoisted(() => vi.fn());
const mockListFamilyDates = vi.hoisted(() => vi.fn());
const mockListMemberBirthdays = vi.hoisted(() => vi.fn());
const mockCreateFamilyDate = vi.hoisted(() => vi.fn());
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

vi.mock('@/features/family/list-member-birthdays', () => ({
  listMemberBirthdays: (...args: unknown[]) => mockListMemberBirthdays(...args),
}));

vi.mock('@/features/notifications/family-activity-notifications', () => ({
  notifyMemorableDateCreated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/family/create-family-date', () => ({
  createFamilyDate: (...args: unknown[]) => mockCreateFamilyDate(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
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
    mockListMemberBirthdays.mockReset();
    mockCreateFamilyDate.mockReset();
    mockDeleteReturning.mockReset();
    mockRevalidatePath.mockReset();
  });

  it('loadFamilyDatesAction returns dates and member birthdays', async () => {
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
    mockListMemberBirthdays.mockResolvedValue([
      {
        userId: 2,
        displayName: 'Олег',
        month: 1,
        day: 15,
        year: 1990,
        nextOccurrence: '2027-01-15',
      },
    ]);

    const { loadFamilyDatesAction } = await import('./date-actions');
    await expect(loadFamilyDatesAction()).resolves.toEqual({
      ok: true,
      canManage: true,
      dates: [
        expect.objectContaining({ title: 'Wedding', kind: 'anniversary' }),
      ],
      memberBirthdays: [
        expect.objectContaining({ displayName: 'Олег', month: 1, day: 15 }),
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
    expect(mockCreateFamilyDate).not.toHaveBeenCalled();
  });

  it('createFamilyDateAction inserts a valid recurring date', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'owner' });
    mockCreateFamilyDate.mockResolvedValue({
      id: 44,
      title: 'Wedding',
      kind: 'anniversary',
      month: 6,
      day: 15,
      year: 2018,
    });

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
    expect(mockCreateFamilyDate).toHaveBeenCalledWith({
      familyId: 9,
      createdBy: 2,
      title: 'Wedding',
      kind: 'anniversary',
      month: 6,
      day: 15,
      year: 2018,
      notes: 'Together',
    });
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
