import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockDeleteWhere = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectFrom = vi.hoisted(() => vi.fn());
const mockSelectOrderBy = vi.hoisted(() => vi.fn());
const mockSelectChainLimit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/server/db/client', () => ({
  withDbRetry: (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/features/notes/note-visibility', async () => {
  const actual = await vi.importActual<typeof import('@/features/notes/note-visibility')>(
    '@/features/notes/note-visibility',
  );
  return {
    ...actual,
    noteVisibilityConditions: () => ['visibility'],
  };
});

vi.mock('@/lib/server/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: (...args: unknown[]) => mockSelectFrom(...args),
    })),
    delete: vi.fn(() => ({
      where: (...args: unknown[]) => mockDeleteWhere(...args),
    })),
  },
}));

vi.mock('@/lib/server/db/schema', () => ({
  notes: {
    id: 'id',
    familyId: 'family_id',
    title: 'title',
    content: 'content',
    category: 'category',
    privacyLevel: 'privacy_level',
    createdBy: 'created_by',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((value: unknown) => value),
  eq: vi.fn((...args: unknown[]) => args),
}));

describe('listVisibleNotes / deleteVisibleNote', () => {
  beforeEach(() => {
    mockSelectLimit.mockReset();
    mockDeleteWhere.mockReset();
    mockSelectWhere.mockReset();
    mockSelectFrom.mockReset();
    mockSelectOrderBy.mockReset();
    mockSelectChainLimit.mockReset();

    mockSelectChainLimit.mockResolvedValue([]);
    mockSelectOrderBy.mockReturnValue({ limit: mockSelectChainLimit });
    mockSelectWhere.mockReturnValue({ orderBy: mockSelectOrderBy, limit: mockSelectLimit });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectLimit.mockResolvedValue([{ id: 1, createdBy: 2 }]);
    mockDeleteWhere.mockResolvedValue(undefined);
  });

  it('lists notes with family + visibility filters and clamped limit', async () => {
    mockSelectChainLimit.mockResolvedValue([
      {
        id: 1,
        title: 'Passports',
        content: 'Drawer',
        category: 'document',
        privacyLevel: 'public',
        createdBy: 2,
        createdAt: new Date('2026-09-01T00:00:00Z'),
      },
    ]);

    const { listVisibleNotes } = await import('./list-notes');
    const rows = await listVisibleNotes({
      familyId: 9,
      userId: 2,
      familyRole: 'adult',
      limit: 500,
    });

    expect(rows).toHaveLength(1);
    expect(mockSelectChainLimit).toHaveBeenCalledWith(100);
  });

  it('deleteVisibleNote returns not_found when row is invisible', async () => {
    mockSelectLimit.mockResolvedValue([]);
    const { deleteVisibleNote } = await import('./list-notes');
    await expect(
      deleteVisibleNote({
        familyId: 9,
        userId: 2,
        familyRole: 'adult',
        noteId: 99,
      }),
    ).resolves.toEqual({ ok: false, error: 'not_found' });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it('deleteVisibleNote forbids children from deleting others notes', async () => {
    mockSelectLimit.mockResolvedValue([{ id: 5, createdBy: 1 }]);
    const { deleteVisibleNote } = await import('./list-notes');
    await expect(
      deleteVisibleNote({
        familyId: 9,
        userId: 4,
        familyRole: 'child',
        noteId: 5,
      }),
    ).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  it('deleteVisibleNote lets children delete their own notes', async () => {
    mockSelectLimit.mockResolvedValue([{ id: 5, createdBy: 4 }]);
    const { deleteVisibleNote } = await import('./list-notes');
    await expect(
      deleteVisibleNote({
        familyId: 9,
        userId: 4,
        familyRole: 'child',
        noteId: 5,
      }),
    ).resolves.toEqual({ ok: true });
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it('deleteVisibleNote lets adults delete any visible note', async () => {
    mockSelectLimit.mockResolvedValue([{ id: 5, createdBy: 1 }]);
    const { deleteVisibleNote } = await import('./list-notes');
    await expect(
      deleteVisibleNote({
        familyId: 9,
        userId: 2,
        familyRole: 'adult',
        noteId: 5,
      }),
    ).resolves.toEqual({ ok: true });
  });
});
