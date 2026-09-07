import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockEnsureDbUser = vi.hoisted(() => vi.fn());
const mockListVisibleNotes = vi.hoisted(() => vi.fn());
const mockDeleteVisibleNote = vi.hoisted(() => vi.fn());
const mockUpdateVisibleNotePrivacy = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectFrom = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/server/users/ensure-db-user', () => ({
  ensureDbUser: (...args: unknown[]) => mockEnsureDbUser(...args),
}));

vi.mock('@/features/notes/list-notes', () => ({
  listVisibleNotes: (...args: unknown[]) => mockListVisibleNotes(...args),
  deleteVisibleNote: (...args: unknown[]) => mockDeleteVisibleNote(...args),
  updateVisibleNotePrivacy: (...args: unknown[]) => mockUpdateVisibleNotePrivacy(...args),
}));

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: (...args: unknown[]) => mockSelectFrom(...args),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  users: {
    id: 'id',
    email: 'email',
    name: 'name',
    displayName: 'display_name',
    familyId: 'family_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

describe('note actions', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockEnsureDbUser.mockReset();
    mockListVisibleNotes.mockReset();
    mockDeleteVisibleNote.mockReset();
    mockUpdateVisibleNotePrivacy.mockReset();
    mockRevalidatePath.mockReset();
    mockSelectWhere.mockReset();
    mockSelectFrom.mockReset();
    mockSelectWhere.mockResolvedValue([]);
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  });

  it('loadVisibleNotesAction returns unauthorized without clerk session', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { loadVisibleNotesAction } = await import('./note-actions');
    await expect(loadVisibleNotesAction()).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    });
  });

  it('loadVisibleNotesAction returns notes for family members', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'adult' });
    mockListVisibleNotes.mockResolvedValue([{ id: 1, title: 'Milk' }]);
    mockSelectWhere.mockResolvedValue([
      { id: 2, email: 'a@x', name: 'A', displayName: 'Me' },
      { id: 3, email: 'b@x', name: 'B', displayName: 'Mom' },
    ]);

    const { loadVisibleNotesAction } = await import('./note-actions');
    await expect(loadVisibleNotesAction()).resolves.toEqual({
      ok: true,
      notes: [{ id: 1, title: 'Milk' }],
      currentUserId: 2,
      familyRole: 'adult',
      members: [{ id: 3, label: 'Mom' }],
    });
  });

  it('deleteNoteAction validates input and deletes', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockEnsureDbUser.mockResolvedValue({ id: 2, familyId: 9, familyRole: 'owner' });
    mockDeleteVisibleNote.mockResolvedValue({ ok: true });

    const { deleteNoteAction } = await import('./note-actions');
    await expect(deleteNoteAction({ noteId: 0 })).resolves.toEqual({
      ok: false,
      error: 'invalid_input',
    });
    await expect(deleteNoteAction({ noteId: 12 })).resolves.toEqual({ ok: true });
    expect(mockDeleteVisibleNote).toHaveBeenCalledWith({
      familyId: 9,
      userId: 2,
      familyRole: 'owner',
      noteId: 12,
    });
    expect(mockRevalidatePath).toHaveBeenCalled();
  });
});
