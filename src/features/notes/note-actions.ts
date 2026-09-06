'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { deleteVisibleNote, listVisibleNotes, type VisibleNote } from '@/features/notes/list-notes';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';

export type NoteActionError =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'db_unavailable';

async function loadActor(clerkUserId: string) {
  const actor = await ensureDbUser(clerkUserId);
  if (!actor?.familyId || !actor.familyRole) {
    return null;
  }
  return {
    userId: actor.id,
    familyId: actor.familyId,
    familyRole: actor.familyRole as 'owner' | 'adult' | 'child',
  };
}

export async function loadVisibleNotesAction(): Promise<
  {
    ok: true;
    notes: VisibleNote[];
    currentUserId: number;
    familyRole: 'owner' | 'adult' | 'child';
  }
  | { ok: false; error: NoteActionError }
> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor) {
      return { ok: false, error: 'forbidden' };
    }
    const rows = await listVisibleNotes({
      familyId: actor.familyId,
      userId: actor.userId,
      familyRole: actor.familyRole,
    });
    return {
      ok: true,
      notes: rows,
      currentUserId: actor.userId,
      familyRole: actor.familyRole,
    };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}

const deleteSchema = z.object({
  noteId: z.coerce.number().int().positive(),
});

export async function deleteNoteAction(
  input: z.infer<typeof deleteSchema>,
): Promise<{ ok: true } | { ok: false; error: NoteActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor) {
      return { ok: false, error: 'forbidden' };
    }

    const result = await deleteVisibleNote({
      familyId: actor.familyId,
      userId: actor.userId,
      familyRole: actor.familyRole,
      noteId: parsed.data.noteId,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    revalidatePath('/[locale]/dashboard', 'page');
    return { ok: true };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}
