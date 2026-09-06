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
