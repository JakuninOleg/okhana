import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendPushToUsers = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

vi.mock('@/features/notifications/web-push', () => ({
  sendPushToUsers: (...args: unknown[]) => mockSendPushToUsers(...args),
}));

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  users: { id: 'id', familyId: 'family_id', familyRole: 'family_role' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}));

function mockMembers(
  rows: Array<{ id: number; familyRole: 'owner' | 'adult' | 'child' | null }>,
): void {
  mockSelect.mockReturnValue({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(rows),
    })),
  });
}

describe('family activity notifications', () => {
  beforeEach(() => {
    mockSendPushToUsers.mockReset();
    mockSelect.mockReset();
  });

  it('notifyEventCreated pushes other family members', async () => {
    mockMembers([
      { id: 1, familyRole: 'owner' },
      { id: 2, familyRole: 'adult' },
      { id: 3, familyRole: 'child' },
    ]);
    const { notifyEventCreated } = await import('./family-activity-notifications');
    await notifyEventCreated({
      familyId: 9,
      createdBy: 1,
      eventId: 44,
      eventTitle: 'Dentist',
    });
    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [2, 3],
      expect.objectContaining({ body: '📅 New event: «Dentist»', tag: 'event-44' }),
    );
  });

  it('notifyEventCreated targets participants when provided', async () => {
    const { notifyEventCreated } = await import('./family-activity-notifications');
    await notifyEventCreated({
      familyId: 9,
      createdBy: 1,
      eventId: 45,
      eventTitle: 'Board games',
      participantUserIds: [2, 1],
    });
    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [2],
      expect.objectContaining({
        body: '📅 You’re included: «Board games»',
        tag: 'event-45',
      }),
    );
  });

  it('notifyEventCreated no-ops when only the creator is a participant', async () => {
    const { notifyEventCreated } = await import('./family-activity-notifications');
    await notifyEventCreated({
      familyId: 9,
      createdBy: 1,
      eventId: 46,
      eventTitle: 'Solo reminder',
      participantUserIds: [1],
    });
    expect(mockSendPushToUsers).not.toHaveBeenCalled();
  });

  it('notifyMemorableDateCreated pushes other family members', async () => {
    mockMembers([
      { id: 1, familyRole: 'owner' },
      { id: 2, familyRole: 'adult' },
    ]);
    const { notifyMemorableDateCreated } = await import('./family-activity-notifications');
    await notifyMemorableDateCreated({
      familyId: 9,
      createdBy: 2,
      dateId: 7,
      dateTitle: 'Wedding',
    });
    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [1],
      expect.objectContaining({ body: '💝 Wedding', tag: 'date-7' }),
    );
  });

  it('notifyNoteCreated skips personal notes', async () => {
    mockMembers([{ id: 1, familyRole: 'owner' }, { id: 2, familyRole: 'adult' }]);
    const { notifyNoteCreated } = await import('./family-activity-notifications');
    await notifyNoteCreated({
      familyId: 9,
      createdBy: 1,
      noteTitle: 'Secret',
      privacyLevel: 'personal',
    });
    expect(mockSendPushToUsers).not.toHaveBeenCalled();
  });

  it('notifyNoteCreated skips children for adults_only notes', async () => {
    mockMembers([
      { id: 1, familyRole: 'owner' },
      { id: 2, familyRole: 'adult' },
      { id: 3, familyRole: 'child' },
    ]);
    const { notifyNoteCreated } = await import('./family-activity-notifications');
    await notifyNoteCreated({
      familyId: 9,
      createdBy: 1,
      noteTitle: 'Budget',
      privacyLevel: 'adults_only',
    });
    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [2],
      expect.objectContaining({ body: '📝 Budget' }),
    );
  });

  it('notifyNoteCreated respects hiddenFrom', async () => {
    mockMembers([
      { id: 1, familyRole: 'owner' },
      { id: 2, familyRole: 'adult' },
      { id: 3, familyRole: 'adult' },
    ]);
    const { notifyNoteCreated } = await import('./family-activity-notifications');
    await notifyNoteCreated({
      familyId: 9,
      createdBy: 1,
      noteTitle: 'Surprise',
      privacyLevel: 'public',
      hiddenFrom: [2],
    });
    expect(mockSendPushToUsers).toHaveBeenCalledWith(
      [3],
      expect.objectContaining({ body: '📝 Surprise' }),
    );
  });
});
