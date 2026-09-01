import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { getCachedChatContext, setCachedChatContext } from '@/features/chat/chat-context-cache';
import {
  getCachedDashboardFamily,
  setCachedDashboardFamily,
  type DashboardFamilyData,
  type DashboardFamilyMember,
} from '@/features/family/family-cache';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { families, users } from '@/lib/server/db/schema';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';

export type { DashboardFamilyData, DashboardFamilyMember };
export { invalidateDashboardFamilyCache } from '@/features/family/family-cache';

async function queryDashboardFamily(clerkUserId: string): Promise<DashboardFamilyData> {
  // Clerk API + user sync must stay outside the DB mutex — withDbRetry serializes
  // all Postgres access and nested calls deadlocked here (4s query timeouts).
  const sync = await ensureDbUser(clerkUserId);

  return withDbRetry(async () => {
    const [result] = await db
      .select({
        userId: users.id,
        email: users.email,
        familyRole: users.familyRole,
        familyId: families.id,
        familyName: families.name,
        inviteCode: families.inviteCode,
      })
      .from(users)
      .leftJoin(families, eq(users.familyId, families.id))
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    const familyId = result?.familyId ?? sync?.familyId ?? null;
    const hasFamily = result?.familyName != null;

    const members = hasFamily && familyId
      ? await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          familyRole: users.familyRole,
        })
        .from(users)
        .where(eq(users.familyId, familyId))
      : [];

    if (result?.userId && familyId && result.familyRole) {
      const existing = getCachedChatContext(clerkUserId);
      setCachedChatContext(clerkUserId, {
        familyId,
        userId: result.userId,
        familyRole: result.familyRole,
        conversationId: existing?.conversationId ?? null,
        isNewConversation: existing?.isNewConversation ?? true,
        familyMembers: members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.familyRole,
        })),
      });
    }

    return {
      email: result?.email ?? sync?.email ?? '',
      familyName: result?.familyName ?? null,
      familyId,
      inviteCode: result?.inviteCode ?? null,
      hasFamily,
      members: members.map((member) => ({
        email: member.email,
        familyRole: member.familyRole,
      })),
      dbError: null,
    };
  });
}

export const getDashboardFamilyData = cache(async (clerkUserId: string): Promise<DashboardFamilyData> => {
  const cached = getCachedDashboardFamily(clerkUserId);
  if (cached) {
    return cached;
  }

  try {
    const data = await queryDashboardFamily(clerkUserId);
    setCachedDashboardFamily(clerkUserId, data);
    return data;
  } catch (error) {
    console.error('dashboard family load failed', {
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
    });
    return {
      email: '',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      members: [],
      dbError: 'Database temporarily unavailable. Try again shortly.',
    };
  }
});
