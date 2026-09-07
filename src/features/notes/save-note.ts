import { loadActiveFamilyMember } from '@/lib/server/family/assert-family-member';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { notes } from '@/lib/server/db/schema';

type NoteCategory = 'general' | 'document' | 'medical' | 'finance' | 'reminder';
type PrivacyLevel = 'public' | 'adults_only' | 'personal';

type SaveNoteInput = {
  familyId: number;
  createdBy: number;
  title: string;
  content: string;
  category?: NoteCategory;
  privacyLevel?: PrivacyLevel;
  hiddenFrom?: number[];
};

export async function saveNote(input: SaveNoteInput): Promise<void> {
  const member = await loadActiveFamilyMember(input.createdBy, input.familyId);
  if (!member) {
    throw new Error('Creator is not in this family');
  }

  await withDbRetry(async () => {
    await db.insert(notes).values({
      familyId: member.familyId,
      createdBy: input.createdBy,
      title: input.title,
      content: input.content,
      category: input.category ?? 'general',
      privacyLevel: input.privacyLevel ?? 'public',
      hiddenFrom: input.hiddenFrom && input.hiddenFrom.length > 0 ? input.hiddenFrom : null,
    });
  });
}
