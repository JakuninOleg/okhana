import { and, eq } from 'drizzle-orm';
import { KINSHIP_OPTIONS, type KinshipOption } from '@/features/family/family-member-types';
import { db } from '@/lib/server/db';
import { memberKinshipViews, users } from '@/lib/server/db/schema';

export type KinshipLabel = KinshipOption;

/**
 * Kinship is viewer-specific: how *I* call you (mom/dad/…) — not a shared family fact.
 * Falls back to legacy users.kinship_label until rows exist in member_kinship_views.
 *
 * Callers that use withDbRetry must NOT wrap these in a nested withDbRetry (mutex is not reentrant).
 */
export async function listKinshipLabelsForViewer(input: {
  familyId: number;
  viewerUserId: number;
}): Promise<Map<number, string | null>> {
  const members = await db
    .select({
      id: users.id,
      legacyKinship: users.kinshipLabel,
    })
    .from(users)
    .where(eq(users.familyId, input.familyId));

  const views = await db
    .select({
      subjectUserId: memberKinshipViews.subjectUserId,
      kinshipLabel: memberKinshipViews.kinshipLabel,
    })
    .from(memberKinshipViews)
    .where(
      and(
        eq(memberKinshipViews.familyId, input.familyId),
        eq(memberKinshipViews.viewerUserId, input.viewerUserId),
      ),
    );

  const bySubject = new Map(views.map((row) => [row.subjectUserId, row.kinshipLabel]));
  const result = new Map<number, string | null>();
  for (const member of members) {
    if (member.id === input.viewerUserId) {
      result.set(member.id, null);
      continue;
    }
    result.set(
      member.id,
      bySubject.get(member.id) ?? member.legacyKinship ?? null,
    );
  }
  return result;
}

export async function upsertViewerKinship(input: {
  familyId: number;
  viewerUserId: number;
  subjectUserId: number;
  kinshipLabel: string | null;
}): Promise<{ ok: true } | { ok: false; error: 'forbidden' | 'invalid_input' }> {
  if (input.viewerUserId === input.subjectUserId) {
    return { ok: false, error: 'invalid_input' };
  }
  if (
    input.kinshipLabel !== null
    && !(KINSHIP_OPTIONS as readonly string[]).includes(input.kinshipLabel)
  ) {
    return { ok: false, error: 'invalid_input' };
  }

  const members = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.familyId, input.familyId));
  const ids = new Set(members.map((m) => m.id));
  if (!ids.has(input.viewerUserId) || !ids.has(input.subjectUserId)) {
    return { ok: false, error: 'forbidden' };
  }

  if (input.kinshipLabel === null) {
    await db
      .delete(memberKinshipViews)
      .where(
        and(
          eq(memberKinshipViews.viewerUserId, input.viewerUserId),
          eq(memberKinshipViews.subjectUserId, input.subjectUserId),
        ),
      );
    return { ok: true };
  }

  await db
    .insert(memberKinshipViews)
    .values({
      familyId: input.familyId,
      viewerUserId: input.viewerUserId,
      subjectUserId: input.subjectUserId,
      kinshipLabel: input.kinshipLabel,
    })
    .onConflictDoUpdate({
      target: [memberKinshipViews.viewerUserId, memberKinshipViews.subjectUserId],
      set: {
        kinshipLabel: input.kinshipLabel,
        familyId: input.familyId,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}
