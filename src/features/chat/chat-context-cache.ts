type FamilyRole = 'owner' | 'adult' | 'child';

export type CachedChatContext = {
  familyId: number;
  userId: number;
  familyRole: FamilyRole;
  /** Null until the first successful conversation row is loaded/created. */
  conversationId: number | null;
  isNewConversation: boolean;
  familyMembers: Array<{
    id: number;
    name: string | null;
    email: string;
    role: FamilyRole | null;
  }>;
  cachedAt: number;
};

type GlobalChatCache = typeof globalThis & {
  __okhanaChatContextCache?: Map<string, CachedChatContext>;
};

const TTL_MS = 10 * 60_000;

function cacheMap(): Map<string, CachedChatContext> {
  const globalCache = globalThis as GlobalChatCache;
  if (!globalCache.__okhanaChatContextCache) {
    globalCache.__okhanaChatContextCache = new Map();
  }
  return globalCache.__okhanaChatContextCache;
}

export function getCachedChatContext(clerkUserId: string): CachedChatContext | null {
  const hit = cacheMap().get(clerkUserId);
  if (!hit) {
    return null;
  }
  if (Date.now() - hit.cachedAt > TTL_MS) {
    cacheMap().delete(clerkUserId);
    return null;
  }
  return hit;
}

export function setCachedChatContext(
  clerkUserId: string,
  context: Omit<CachedChatContext, 'cachedAt'>,
): void {
  cacheMap().set(clerkUserId, { ...context, cachedAt: Date.now() });
}
