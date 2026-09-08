import { and, desc, eq } from 'drizzle-orm';
import {
  noteVisibilityConditions,
  type FamilyRole,
} from '@/features/notes/note-visibility';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { notes } from '@/lib/server/db/schema';

export type VisibleNote = {
  id: number;
  title: string;
  content: string;
  category: 'general' | 'document' | 'medical' | 'finance' | 'reminder';
  privacyLevel: 'public' | 'adults_only' | 'personal';
  hiddenFrom: number[] | null;
  createdBy: number | null;
  createdAt: Date;
};

type ListVisibleNotesInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  limit?: number;
};

export async function listVisibleNotes(
  input: ListVisibleNotesInput,
): Promise<VisibleNote[]> {
  const maxResults = Math.min(Math.max(input.limit ?? 50, 1), 100);

  return withDbRetry(async () => db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      category: notes.category,
      privacyLevel: notes.privacyLevel,
      hiddenFrom: notes.hiddenFrom,
      createdBy: notes.createdBy,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.familyId, input.familyId),
        ...noteVisibilityConditions({
          userId: input.userId,
          familyRole: input.familyRole,
        }),
      ),
    )
    .orderBy(desc(notes.createdAt))
    .limit(maxResults));
}

type DeleteVisibleNoteInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  noteId: number;
};

/**
 * Owners/adults may delete any visible note; children only their own.
 * Visibility is re-checked so ACL cannot be bypassed by guessing ids.
 */
export async function deleteVisibleNote(
  input: DeleteVisibleNoteInput,
): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'forbidden' }> {
  return withDbRetry(async () => {
    const [row] = await db
      .select({
        id: notes.id,
        createdBy: notes.createdBy,
      })
      .from(notes)
      .where(
        and(
          eq(notes.id, input.noteId),
          eq(notes.familyId, input.familyId),
          ...noteVisibilityConditions({
            userId: input.userId,
            familyRole: input.familyRole,
          }),
        ),
      )
      .limit(1);

    if (!row) {
      return { ok: false, error: 'not_found' };
    }

    const isOwnerOrAdult = input.familyRole === 'owner' || input.familyRole === 'adult';
    const isAuthor = row.createdBy === input.userId;
    if (!isOwnerOrAdult && !isAuthor) {
      return { ok: false, error: 'forbidden' };
    }

    await db
      .delete(notes)
      .where(and(eq(notes.id, input.noteId), eq(notes.familyId, input.familyId)));

    return { ok: true };
  });
}

export type UpdateNotePrivacyInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  noteId: number;
  privacyLevel: 'public' | 'adults_only' | 'personal';
  hiddenFrom: number[];
};

/**
 * Author (or owner/adult) may change privacy + hide-from on a note they can see.
 * Visibility is re-checked; children only edit their own notes.
 */
export async function updateVisibleNotePrivacy(
  input: UpdateNotePrivacyInput,
): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'forbidden' }> {
  return withDbRetry(async () => {
    const [row] = await db
      .select({
        id: notes.id,
        createdBy: notes.createdBy,
      })
      .from(notes)
      .where(
        and(
          eq(notes.id, input.noteId),
          eq(notes.familyId, input.familyId),
          ...noteVisibilityConditions({
            userId: input.userId,
            familyRole: input.familyRole,
          }),
        ),
      )
      .limit(1);

    if (!row) {
      return { ok: false, error: 'not_found' };
    }

    const isOwnerOrAdult = input.familyRole === 'owner' || input.familyRole === 'adult';
    const isAuthor = row.createdBy === input.userId;
    if (!isOwnerOrAdult && !isAuthor) {
      return { ok: false, error: 'forbidden' };
    }

    const hiddenFrom =
      input.privacyLevel === 'personal'
        ? null
        : input.hiddenFrom.length > 0
          ? [...new Set(input.hiddenFrom.filter((id) => id !== input.userId))]
          : null;

    await db
      .update(notes)
      .set({
        privacyLevel: input.privacyLevel,
        hiddenFrom,
      })
      .where(and(eq(notes.id, input.noteId), eq(notes.familyId, input.familyId)));

    return { ok: true };
  });
}

export type UpdateNoteContentInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  noteId: number;
  title: string;
  content: string;
};

/**
 * Author may edit title/content of their own note.
 * Owners/adults may edit any visible note (same gate as delete).
 */
export async function updateVisibleNoteContent(
  input: UpdateNoteContentInput,
): Promise<{ ok: true } | { ok: false; error: 'not_found' | 'forbidden' | 'invalid_input' }> {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) {
    return { ok: false, error: 'invalid_input' };
  }
  if (title.length > 255 || content.length > 8000) {
    return { ok: false, error: 'invalid_input' };
  }

  return withDbRetry(async () => {
    const [row] = await db
      .select({
        id: notes.id,
        createdBy: notes.createdBy,
      })
      .from(notes)
      .where(
        and(
          eq(notes.id, input.noteId),
          eq(notes.familyId, input.familyId),
          ...noteVisibilityConditions({
            userId: input.userId,
            familyRole: input.familyRole,
          }),
        ),
      )
      .limit(1);

    if (!row) {
      return { ok: false, error: 'not_found' };
    }

    const isOwnerOrAdult = input.familyRole === 'owner' || input.familyRole === 'adult';
    const isAuthor = row.createdBy === input.userId;
    if (!isAuthor && !isOwnerOrAdult) {
      return { ok: false, error: 'forbidden' };
    }

    await db
      .update(notes)
      .set({ title, content })
      .where(and(eq(notes.id, input.noteId), eq(notes.familyId, input.familyId)));

    return { ok: true };
  });
}
