import { describe, expect, it } from 'vitest';
import { noteIsVisibleToViewer } from '@/features/notes/note-visibility';

describe('noteIsVisibleToViewer', () => {
  const publicNote = {
    privacyLevel: 'public' as const,
    createdBy: 1,
    hiddenFrom: null,
  };

  it('shows public notes to everyone including children', () => {
    expect(noteIsVisibleToViewer(publicNote, { userId: 9, familyRole: 'child' })).toBe(true);
    expect(noteIsVisibleToViewer(publicNote, { userId: 1, familyRole: 'owner' })).toBe(true);
  });

  it('hides adults_only notes from children but not adults', () => {
    const note = { ...publicNote, privacyLevel: 'adults_only' as const };
    expect(noteIsVisibleToViewer(note, { userId: 9, familyRole: 'child' })).toBe(false);
    expect(noteIsVisibleToViewer(note, { userId: 2, familyRole: 'adult' })).toBe(true);
  });

  it('shows personal notes only to the author', () => {
    const note = { ...publicNote, privacyLevel: 'personal' as const, createdBy: 3 };
    expect(noteIsVisibleToViewer(note, { userId: 3, familyRole: 'adult' })).toBe(true);
    expect(noteIsVisibleToViewer(note, { userId: 1, familyRole: 'owner' })).toBe(false);
  });

  it('hides notes when the viewer is in hiddenFrom', () => {
    const note = { ...publicNote, hiddenFrom: [5, 7] };
    expect(noteIsVisibleToViewer(note, { userId: 5, familyRole: 'adult' })).toBe(false);
    expect(noteIsVisibleToViewer(note, { userId: 8, familyRole: 'adult' })).toBe(true);
  });

  it('applies child + hiddenFrom together', () => {
    const note = {
      privacyLevel: 'adults_only' as const,
      createdBy: 1,
      hiddenFrom: [9],
    };
    expect(noteIsVisibleToViewer(note, { userId: 9, familyRole: 'child' })).toBe(false);
  });
});
