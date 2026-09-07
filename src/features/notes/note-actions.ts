'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { updateVisibleNotePrivacy, deleteVisibleNote, listVisibleNotes, type VisibleNote } from '@/features/notes/list-notes';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { memberDisplayLabel } from '@/features/family/family-member-types';

export type NoteActionError =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'db_unavailable';

export type NoteMemberOption = {
  id: number;
  label: string;
};
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
    members: NoteMemberOption[];
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
    const [rows, memberRows] = await Promise.all([
      listVisibleNotes({
        familyId: actor.familyId,
        userId: actor.userId,
        familyRole: actor.familyRole,
      }),
      withDbRetry(async () =>
        db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            displayName: users.displayName,
          })
          .from(users)
          .where(eq(users.familyId, actor.familyId)),
      ),
    ]);
    return {
      ok: true,
      notes: rows,
      currentUserId: actor.userId,
      familyRole: actor.familyRole,
      members: memberRows
        .filter((row) => row.id !== actor.userId)
        .map((row) => ({ id: row.id, label: memberDisplayLabel(row) })),
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

const privacySchema = z.object({
  noteId: z.coerce.number().int().positive(),
  privacyLevel: z.enum(['public', 'adults_only', 'personal']),
  hiddenFrom: z.array(z.coerce.number().int().positive()).default([]),
});

export async function updateNotePrivacyAction(
  input: z.infer<typeof privacySchema>,
): Promise<{ ok: true } | { ok: false; error: NoteActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = privacySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor) {
      return { ok: false, error: 'forbidden' };
    }

    const result = await updateVisibleNotePrivacy({
      familyId: actor.familyId,
      userId: actor.userId,
      familyRole: actor.familyRole,
      noteId: parsed.data.noteId,
      privacyLevel: parsed.data.privacyLevel,
      hiddenFrom: parsed.data.hiddenFrom,
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
