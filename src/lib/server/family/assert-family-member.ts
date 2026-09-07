import { and, eq } from 'drizzle-orm';
import type { FamilyRole } from '@/features/family/family-member-types';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';

export type ActiveFamilyMember = {
  userId: number;
  clerkId: string;
  familyId: number;
  familyRole: FamilyRole;
};

/**
 * Live membership check — never trust cached familyId/role for mutations or AI tools.
 */
export async function loadActiveFamilyMember(
  userId: number,
  expectedFamilyId?: number,
): Promise<ActiveFamilyMember | null> {
  return withDbRetry(async () => {
    const [row] = await db
      .select({
        userId: users.id,
        clerkId: users.clerkId,
        familyId: users.familyId,
        familyRole: users.familyRole,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row?.familyId || !row.familyRole) {
      return null;
    }
    if (expectedFamilyId !== undefined && row.familyId !== expectedFamilyId) {
      return null;
    }
    return {
      userId: row.userId,
      clerkId: row.clerkId,
      familyId: row.familyId,
      familyRole: row.familyRole,
    };
  });
}

export async function assertUsersShareFamily(
  userIds: number[],
  familyId: number,
): Promise<boolean> {
  if (userIds.length === 0) {
    return true;
  }
  const unique = [...new Set(userIds)];
  return withDbRetry(async () => {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.familyId, familyId)));
    const inFamily = new Set(rows.map((r) => r.id));
    return unique.every((id) => inFamily.has(id));
  });
}
