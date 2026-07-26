import { and, arrayContains, eq, ilike, isNull, ne, not, or } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { notes } from '@/lib/server/db/schema';

type FamilyRole = 'owner' | 'adult' | 'child';

type SearchNotesInput = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  query: string;
  limit?: number;
};

export type SearchNoteResult = {
  id: number;
  title: string;
  content: string;
  category: 'general' | 'document' | 'medical' | 'finance' | 'reminder';
  privacyLevel: 'public' | 'adults_only' | 'personal';
  createdAt: Date;
};

export async function searchNotes(input: SearchNotesInput): Promise<SearchNoteResult[]> {
  const trimmedQuery = input.query.trim();
  const queryPattern = `%${trimmedQuery}%`;
  const maxResults = Math.min(Math.max(input.limit ?? 5, 1), 10);

  return withDbRetry(async () => db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      category: notes.category,
      privacyLevel: notes.privacyLevel,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(
      and(
        eq(notes.familyId, input.familyId),
        or(ilike(notes.title, queryPattern), ilike(notes.content, queryPattern)),
        input.familyRole === 'child' ? ne(notes.privacyLevel, 'adults_only') : undefined,
        or(ne(notes.privacyLevel, 'personal'), eq(notes.createdBy, input.userId)),
        or(isNull(notes.hiddenFrom), not(arrayContains(notes.hiddenFrom, [input.userId]))),
      ),
    )
    .limit(maxResults));
}
