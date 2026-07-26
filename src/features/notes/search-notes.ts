import { and, arrayContains, desc, eq, isNull, ne, not, or, sql } from 'drizzle-orm';
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

function escapeLikeMetacharacters(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function searchNotes(input: SearchNotesInput): Promise<SearchNoteResult[]> {
  const trimmedQuery = input.query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const queryPattern = `%${escapeLikeMetacharacters(trimmedQuery)}%`;
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
        or(
          sql`${notes.title} ILIKE ${queryPattern} ESCAPE '\\'`,
          sql`${notes.content} ILIKE ${queryPattern} ESCAPE '\\'`,
        ),
        input.familyRole === 'child' ? ne(notes.privacyLevel, 'adults_only') : undefined,
        or(ne(notes.privacyLevel, 'personal'), eq(notes.createdBy, input.userId)),
        or(isNull(notes.hiddenFrom), not(arrayContains(notes.hiddenFrom, [input.userId]))),
      ),
    )
    .orderBy(desc(notes.createdAt))
    .limit(maxResults));
}
