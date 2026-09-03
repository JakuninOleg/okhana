import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { getCachedChatContext, setCachedChatContext } from '@/features/chat/chat-context-cache';
import type { DashboardFamilyMemberProfile } from '@/features/family/family-member-types';
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

function mapMemberRow(
  member: {
    id: number;
    email: string;
    name: string | null;
    displayName: string | null;
    familyRole: 'owner' | 'adult' | 'child' | null;
    kinshipLabel: string | null;
    profileSex: 'female' | 'male' | 'unspecified';
    birthDate: string | null;
    profileColor: string | null;
  },
  currentUserId: number | null,
): DashboardFamilyMemberProfile {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    displayName: member.displayName,
    familyRole: member.familyRole,
    kinshipLabel: member.kinshipLabel,
    profileSex: member.profileSex,
    birthDate: member.birthDate,
    profileColor: member.profileColor,
    isCurrentUser: currentUserId === member.id,
  };
}

async function queryDashboardFamily(clerkUserId: string): Promise<DashboardFamilyData> {
  const sync = await ensureDbUser(clerkUserId);

  if (!sync) {
    return {
      email: '',
      userDisplayName: '',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      currentUserId: null,
      currentUserRole: null,
      members: [],
      dbError: null,
    };
  }

  if (!sync.familyId) {
    return {
      email: sync.email,
      userDisplayName: sync.displayName ?? sync.name ?? sync.email.split('@')[0] ?? '',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      currentUserId: sync.id,
      currentUserRole: sync.familyRole,
      members: [],
      dbError: null,
    };
  }

  const familyId = sync.familyId;

  return withDbRetry(async () => {
    // Sequential on purpose: transaction pooler + max:1 cannot run Promise.all
    // safely — concurrent queries destroy the socket (CONNECTION_DESTROYED).
    const [family] = await db
      .select({
        id: families.id,
        familyName: families.name,
        inviteCode: families.inviteCode,
      })
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);

    const memberRows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        familyRole: users.familyRole,
        kinshipLabel: users.kinshipLabel,
        profileSex: users.profileSex,
        birthDate: users.birthDate,
        profileColor: users.profileColor,
      })
      .from(users)
      .where(eq(users.familyId, familyId));

    const hasFamily = family != null;
    const members = memberRows
      .map((row) => mapMemberRow(row, sync.id))
      .sort((a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser));
    const currentMember = members.find((member) => member.isCurrentUser);
    const userDisplayName = currentMember?.displayName
      ?? currentMember?.name
      ?? sync.displayName
      ?? sync.name
      ?? sync.email.split('@')[0]
      ?? '';

    if (hasFamily && sync.familyRole) {
      const existing = getCachedChatContext(clerkUserId);
      setCachedChatContext(clerkUserId, {
        familyId,
        userId: sync.id,
        familyRole: sync.familyRole,
        conversationId: existing?.conversationId ?? null,
        isNewConversation: existing?.isNewConversation ?? true,
        familyMembers: members.map((member) => ({
          id: member.id,
          name: member.displayName ?? member.name,
          email: member.email,
          role: member.familyRole,
          kinshipLabel: member.kinshipLabel,
          birthDate: member.birthDate,
        })),
      });
    }

    return {
      email: sync.email,
      userDisplayName,
      familyName: family?.familyName ?? null,
      familyId: hasFamily ? familyId : null,
      inviteCode: family?.inviteCode ?? null,
      hasFamily,
      currentUserId: sync.id,
      currentUserRole: sync.familyRole,
      members: hasFamily ? members : [],
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
      userDisplayName: '',
      familyName: null,
      familyId: null,
      inviteCode: null,
      hasFamily: false,
      currentUserId: null,
      currentUserRole: null,
      members: [],
      dbError: 'Database temporarily unavailable. Try again shortly.',
    };
  }
});
