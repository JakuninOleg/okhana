import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockEnsureDbUser = vi.hoisted(() => vi.fn());
const mockListVisibleNotes = vi.hoisted(() => vi.fn());
const mockDeleteVisibleNote = vi.hoisted(() => vi.fn());
const mockRevalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/lib/server/users/ensure-db-user', () => ({
  ensureDbUser: (...args: unknown[]) => mockEnsureDbUser(...args),
}));

vi.mock('@/features/notes/list-notes', () => ({
  listVisibleNotes: (...args: unknown[]) => mockListVisibleNotes(...args),
  deleteVisibleNote: (...args: unknown[]) => mockDeleteVisibleNote(...args),
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
    mockRevalidatePath.mockReset();
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

    const { loadVisibleNotesAction } = await import('./note-actions');
    await expect(loadVisibleNotesAction()).resolves.toEqual({
      ok: true,
      notes: [{ id: 1, title: 'Milk' }],
      currentUserId: 2,
      familyRole: 'adult',
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
