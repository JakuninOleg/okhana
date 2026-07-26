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
const MAX_ENTRIES = 500;

function cacheMap(): Map<string, CachedChatContext> {
  const globalCache = globalThis as GlobalChatCache;
  if (!globalCache.__okhanaChatContextCache) {
    globalCache.__okhanaChatContextCache = new Map();
  }
  return globalCache.__okhanaChatContextCache;
}

function pruneExpired(now = Date.now()): void {
  const map = cacheMap();
  for (const [key, value] of map) {
    if (now - value.cachedAt > TTL_MS) {
      map.delete(key);
    }
  }
}

function enforceBound(): void {
  const map = cacheMap();
  if (map.size <= MAX_ENTRIES) {
    return;
  }
  const overflow = map.size - MAX_ENTRIES;
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

export function getCachedChatContext(clerkUserId: string): CachedChatContext | null {
  pruneExpired();
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
  pruneExpired();
  cacheMap().set(clerkUserId, { ...context, cachedAt: Date.now() });
  enforceBound();
}
