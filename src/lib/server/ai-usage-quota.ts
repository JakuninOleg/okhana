import { sql, and, eq } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { aiUsageFamilyDaily, aiUsageUserDaily } from '@/lib/server/db/schema';

/** Soft-launch defaults — override via env without redeploying code. */
export const DEFAULT_FAMILY_CHAT_DAILY_LIMIT = 150;
export const DEFAULT_USER_CHAT_DAILY_LIMIT = 80;

export type ChatQuotaDenialReason =
  | 'disabled'
  | 'family_daily_limit'
  | 'user_daily_limit';

export type ConsumeChatQuotaResult =
  | {
    ok: true;
    usageDate: string;
    familyCount: number;
    userCount: number;
    familyLimit: number;
    userLimit: number;
  }
  | {
    ok: false;
    reason: ChatQuotaDenialReason;
    usageDate: string;
    familyLimit: number;
    userLimit: number;
    familyCount?: number;
    userCount?: number;
  };

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function getChatDailyLimits(): { familyLimit: number; userLimit: number } {
  return {
    familyLimit: parsePositiveInt(
      process.env.AI_CHAT_DAILY_FAMILY_LIMIT,
      DEFAULT_FAMILY_CHAT_DAILY_LIMIT,
    ),
    userLimit: parsePositiveInt(
      process.env.AI_CHAT_DAILY_USER_LIMIT,
      DEFAULT_USER_CHAT_DAILY_LIMIT,
    ),
  };
}

export function isChatKillSwitchOn(): boolean {
  const raw = process.env.AI_CHAT_DISABLED?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** Calendar day in Europe/Moscow (RF soft-launch “сутки”). */
export function moscowUsageDateYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Atomically consume one chat request against family + user daily ceilings.
 * Uses INSERT … ON CONFLICT DO UPDATE … WHERE count < limit RETURNING —
 * empty RETURNING means the limit was already reached (no partial increment).
 *
 * Intentionally NOT wrapped in withDbRetry: a retry after commit would
 * double-charge the quota for a single user message.
 */
export async function consumeDailyChatQuota(input: {
  familyId: number;
  userId: number;
  now?: Date;
}): Promise<ConsumeChatQuotaResult> {
  const { familyLimit, userLimit } = getChatDailyLimits();
  const usageDate = moscowUsageDateYmd(input.now);

  if (isChatKillSwitchOn()) {
    return {
      ok: false,
      reason: 'disabled',
      usageDate,
      familyLimit,
      userLimit,
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const now = input.now ?? new Date();

      const [familyRow] = await tx
        .insert(aiUsageFamilyDaily)
        .values({
          familyId: input.familyId,
          usageDate,
          chatCount: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [aiUsageFamilyDaily.familyId, aiUsageFamilyDaily.usageDate],
          set: {
            chatCount: sql`${aiUsageFamilyDaily.chatCount} + 1`,
            updatedAt: now,
          },
          setWhere: sql`${aiUsageFamilyDaily.chatCount} < ${familyLimit}`,
        })
        .returning({ chatCount: aiUsageFamilyDaily.chatCount });

      if (!familyRow) {
        return {
          ok: false as const,
          reason: 'family_daily_limit' as const,
          usageDate,
          familyLimit,
          userLimit,
          familyCount: familyLimit,
        };
      }

      const [userRow] = await tx
        .insert(aiUsageUserDaily)
        .values({
          familyId: input.familyId,
          userId: input.userId,
          usageDate,
          chatCount: 1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [aiUsageUserDaily.userId, aiUsageUserDaily.usageDate],
          set: {
            chatCount: sql`${aiUsageUserDaily.chatCount} + 1`,
            updatedAt: now,
          },
          setWhere: sql`${aiUsageUserDaily.chatCount} < ${userLimit}`,
        })
        .returning({ chatCount: aiUsageUserDaily.chatCount });

      if (!userRow) {
        // Roll back family increment by aborting the transaction.
        throw new Error('USER_DAILY_LIMIT');
      }

      return {
        ok: true as const,
        usageDate,
        familyCount: familyRow.chatCount,
        userCount: userRow.chatCount,
        familyLimit,
        userLimit,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_DAILY_LIMIT') {
      return {
        ok: false,
        reason: 'user_daily_limit',
        usageDate,
        familyLimit,
        userLimit,
        userCount: userLimit,
      };
    }
    throw error;
  }
}

export type ChatQuotaSnapshot = {
  usageDate: string;
  familyLimit: number;
  userLimit: number;
  familyUsed: number;
  userUsed: number;
  familyRemaining: number;
  userRemaining: number;
  /** Binding constraint — what the user can still send today. */
  remaining: number;
  disabled: boolean;
};

function buildSnapshot(input: {
  usageDate: string;
  familyLimit: number;
  userLimit: number;
  familyUsed: number;
  userUsed: number;
  disabled?: boolean;
}): ChatQuotaSnapshot {
  const familyRemaining = Math.max(0, input.familyLimit - input.familyUsed);
  const userRemaining = Math.max(0, input.userLimit - input.userUsed);
  return {
    usageDate: input.usageDate,
    familyLimit: input.familyLimit,
    userLimit: input.userLimit,
    familyUsed: input.familyUsed,
    userUsed: input.userUsed,
    familyRemaining,
    userRemaining,
    remaining: Math.min(familyRemaining, userRemaining),
    disabled: input.disabled === true,
  };
}

export function chatQuotaSnapshotFromConsume(
  result: Extract<ConsumeChatQuotaResult, { ok: true }>,
): ChatQuotaSnapshot {
  return buildSnapshot({
    usageDate: result.usageDate,
    familyLimit: result.familyLimit,
    userLimit: result.userLimit,
    familyUsed: result.familyCount,
    userUsed: result.userCount,
  });
}

/** Read-only view of today's usage (does not increment). */
export async function getDailyChatQuotaSnapshot(input: {
  familyId: number;
  userId: number;
  now?: Date;
}): Promise<ChatQuotaSnapshot> {
  const { familyLimit, userLimit } = getChatDailyLimits();
  const usageDate = moscowUsageDateYmd(input.now);

  if (isChatKillSwitchOn()) {
    return buildSnapshot({
      usageDate,
      familyLimit,
      userLimit,
      familyUsed: familyLimit,
      userUsed: userLimit,
      disabled: true,
    });
  }

  const [familyRow] = await db
    .select({ chatCount: aiUsageFamilyDaily.chatCount })
    .from(aiUsageFamilyDaily)
    .where(
      and(
        eq(aiUsageFamilyDaily.familyId, input.familyId),
        eq(aiUsageFamilyDaily.usageDate, usageDate),
      ),
    )
    .limit(1);

  const [userRow] = await db
    .select({ chatCount: aiUsageUserDaily.chatCount })
    .from(aiUsageUserDaily)
    .where(
      and(
        eq(aiUsageUserDaily.userId, input.userId),
        eq(aiUsageUserDaily.usageDate, usageDate),
      ),
    )
    .limit(1);

  return buildSnapshot({
    usageDate,
    familyLimit,
    userLimit,
    familyUsed: familyRow?.chatCount ?? 0,
    userUsed: userRow?.chatCount ?? 0,
  });
}

