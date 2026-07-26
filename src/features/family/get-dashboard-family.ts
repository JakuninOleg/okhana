import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { getCachedChatContext, setCachedChatContext } from '@/features/chat/chat-context-cache';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { families, users } from '@/lib/server/db/schema';

export type DashboardFamilyMember = {
  email: string;
  familyRole: string | null;
};

export type DashboardFamilyData = {
  email: string;
  familyName: string | null;
  familyId: number | null;
  inviteCode: string | null;
  hasFamily: boolean;
  members: DashboardFamilyMember[];
  dbError: string | null;
};

type CacheEntry = { at: number; data: DashboardFamilyData };

type GlobalFamilyCache = typeof globalThis & {
  __okhanaFamilyCache?: Map<string, CacheEntry>;
};

const FAMILY_CACHE_TTL_MS = 30_000;

function familyCache(): Map<string, CacheEntry> {
  const globalCache = globalThis as GlobalFamilyCache;
  if (!globalCache.__okhanaFamilyCache) {
    globalCache.__okhanaFamilyCache = new Map();
  }
  return globalCache.__okhanaFamilyCache;
}

export function invalidateDashboardFamilyCache(clerkUserId: string): void {
  familyCache().delete(clerkUserId);
}

async function queryDashboardFamily(clerkUserId: string): Promise<DashboardFamilyData> {
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

    const familyId = result?.familyId ?? null;
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

    // Warm chat cache so the first message does not wait on Postgres.
    // Preserve an existing conversation session if the cache already has one.
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
      email: result?.email ?? '',
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

/**
 * Per-request React.cache + short in-process TTL so locale switches reuse
 * family data without Next Data Cache revalidation storms against Postgres.
 */
export const getDashboardFamilyData = cache(async (clerkUserId: string): Promise<DashboardFamilyData> => {
  const cached = familyCache().get(clerkUserId);
  if (cached && Date.now() - cached.at < FAMILY_CACHE_TTL_MS && !cached.data.dbError) {
    return cached.data;
  }

  try {
    const data = await queryDashboardFamily(clerkUserId);
    familyCache().set(clerkUserId, { at: Date.now(), data });
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
