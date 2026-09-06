import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockEnsureDbUser = vi.hoisted(() => vi.fn());
const mockListEventsInRange = vi.hoisted(() => vi.fn());
const mockListFamilyDates = vi.hoisted(() => vi.fn());
const mockListMemberBirthdays = vi.hoisted(() => vi.fn());
const mockCreateFamilyEvent = vi.hoisted(() => vi.fn());
const mockDeleteFamilyEvent = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/server/users/ensure-db-user', () => ({
  ensureDbUser: (...args: unknown[]) => mockEnsureDbUser(...args),
}));

vi.mock('@/features/calendar/list-events', () => ({
  listEventsInRange: (...args: unknown[]) => mockListEventsInRange(...args),
  createFamilyEvent: (...args: unknown[]) => mockCreateFamilyEvent(...args),
  deleteFamilyEvent: (...args: unknown[]) => mockDeleteFamilyEvent(...args),
}));

vi.mock('@/features/family/list-family-dates', () => ({
  listFamilyDates: (...args: unknown[]) => mockListFamilyDates(...args),
}));

vi.mock('@/features/family/list-member-birthdays', () => ({
  listMemberBirthdays: (...args: unknown[]) => mockListMemberBirthdays(...args),
}));

vi.mock('@/features/notifications/family-activity-notifications', () => ({
  notifyEventCreated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

describe('calendar actions', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockEnsureDbUser.mockReset();
    mockListEventsInRange.mockReset();
    mockListFamilyDates.mockReset();
    mockListMemberBirthdays.mockReset();
    mockCreateFamilyEvent.mockReset();
    mockDeleteFamilyEvent.mockReset();
    mockRevalidatePath.mockReset();
  });

  it('loadFamilyCalendarAction merges events and memorable dates', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'adult' });
    mockListEventsInRange.mockResolvedValue([{ id: 1, title: 'Trip' }]);
    mockListFamilyDates.mockResolvedValue([{ id: 2, title: 'Anniversary' }]);
    mockListMemberBirthdays.mockResolvedValue([
      { userId: 2, displayName: 'Олег', month: 1, day: 15, year: 1990, nextOccurrence: '2027-01-15' },
    ]);

    const { loadFamilyCalendarAction } = await import('./calendar-actions');
    await expect(
      loadFamilyCalendarAction({
        clientNow: '2026-09-06T12:00:00+03:00',
        year: 2026,
        month: 9,
      }),
    ).resolves.toEqual({
      ok: true,
      events: [{ id: 1, title: 'Trip' }],
      dates: [{ id: 2, title: 'Anniversary' }],
      memberBirthdays: [
        { userId: 2, displayName: 'Олег', month: 1, day: 15, year: 1990, nextOccurrence: '2027-01-15' },
      ],
      canManage: true,
      year: 2026,
      month: 9,
    });
    expect(mockListEventsInRange).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 9, limit: 100 }),
    );
  });

  it('createCalendarEventAction rejects children', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 4, familyId: 9, familyRole: 'child' });

    const { createCalendarEventAction } = await import('./calendar-actions');
    await expect(
      createCalendarEventAction({
        title: 'Party',
        startTime: '2026-09-10T18:00',
      }),
    ).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(mockCreateFamilyEvent).not.toHaveBeenCalled();
  });

  it('createCalendarEventAction creates for adults', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'owner' });
    mockCreateFamilyEvent.mockResolvedValue({ id: 55 });

    const { createCalendarEventAction } = await import('./calendar-actions');
    await expect(
      createCalendarEventAction({
        title: 'Dentist',
        startTime: '2026-09-10T10:00:00+03:00',
        allDay: false,
      }),
    ).resolves.toEqual({ ok: true, id: 55 });
    expect(mockCreateFamilyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: 9,
        createdBy: 2,
        title: 'Dentist',
      }),
    );
  });

  it('createCalendarEventAction rejects bare datetime-local', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'owner' });

    const { createCalendarEventAction } = await import('./calendar-actions');
    await expect(
      createCalendarEventAction({
        title: 'Party',
        startTime: '2026-09-10T18:00',
      }),
    ).resolves.toEqual({ ok: false, error: 'invalid_input' });
    expect(mockCreateFamilyEvent).not.toHaveBeenCalled();
  });

  it('deleteCalendarEventAction forwards ACL result', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'adult' });
    mockDeleteFamilyEvent.mockResolvedValue({ ok: false, error: 'forbidden' });

    const { deleteCalendarEventAction } = await import('./calendar-actions');
    await expect(deleteCalendarEventAction({ eventId: 3 })).resolves.toEqual({
      ok: false,
      error: 'forbidden',
    });
  });
});
