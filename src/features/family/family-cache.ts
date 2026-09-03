import type { DashboardFamilyMemberProfile } from '@/features/family/family-member-types';

export type DashboardFamilyMember = DashboardFamilyMemberProfile;

export type DashboardFamilyData = {
  email: string;
  userDisplayName: string;
  familyName: string | null;
  familyId: number | null;
  inviteCode: string | null;
  hasFamily: boolean;
  currentUserId: number | null;
  currentUserRole: string | null;
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

export function getCachedDashboardFamily(clerkUserId: string): DashboardFamilyData | null {
  const cached = familyCache().get(clerkUserId);
  if (cached && Date.now() - cached.at < FAMILY_CACHE_TTL_MS && !cached.data.dbError) {
    return cached.data;
  }
  return null;
}

export function setCachedDashboardFamily(clerkUserId: string, data: DashboardFamilyData): void {
  familyCache().set(clerkUserId, { at: Date.now(), data });
}
