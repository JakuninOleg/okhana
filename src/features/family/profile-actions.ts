'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { invalidateCachedChatContext } from '@/features/chat/chat-context-cache';
import { invalidateDashboardFamilyCache } from '@/features/family/get-dashboard-family';
import {
  KINSHIP_OPTIONS,
  type FamilyRole,
} from '@/features/family/family-member-types';
import {
  canChangeMemberRole,
  canEditMemberProfile,
  canRemoveMember,
  canTransferOwnership,
} from '@/features/family/profile-permissions';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { families, users } from '@/lib/server/db/schema';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';

const profileSexSchema = z.enum(['female', 'male', 'unspecified']);
const familyRoleSchema = z.enum(['owner', 'adult', 'child']);

const updateMemberProfileSchema = z.object({
  memberId: z.coerce.number().int().positive(),
  displayName: z.string().max(255).optional(),
  kinshipLabel: z.union([z.enum(KINSHIP_OPTIONS), z.literal('')]).optional(),
  profileSex: profileSexSchema.optional(),
  birthDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional(),
  familyRole: familyRoleSchema.optional(),
});

export type UpdateMemberProfileInput = z.infer<typeof updateMemberProfileSchema>;

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function loadActor(clerkUserId: string) {
  const actor = await ensureDbUser(clerkUserId);
  if (!actor?.familyId || !actor.familyRole) {
    return null;
  }
  return {
    clerkUserId,
    userId: actor.id,
    familyId: actor.familyId,
    familyRole: actor.familyRole as FamilyRole,
  };
}

function revalidateFamilyDashboard(clerkUserId: string, extraClerkIds: string[] = []): void {
  invalidateDashboardFamilyCache(clerkUserId);
  invalidateCachedChatContext(clerkUserId);
  for (const id of extraClerkIds) {
    invalidateDashboardFamilyCache(id);
    invalidateCachedChatContext(id);
  }
  revalidatePath('/[locale]/dashboard', 'page');
}

export async function updateMemberProfile(
  input: UpdateMemberProfileInput,
): Promise<ProfileActionResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'not_authenticated' };
  }

  const parsed = updateMemberProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor) {
      return { ok: false, error: 'no_family' };
    }

    return await withDbRetry(async () => {
      const [target] = await db
        .select({
          id: users.id,
          familyId: users.familyId,
          familyRole: users.familyRole,
        })
        .from(users)
        .where(and(eq(users.id, parsed.data.memberId), eq(users.familyId, actor.familyId)))
        .limit(1);

      if (!target?.familyRole) {
        return { ok: false, error: 'member_not_found' };
      }

      if (!canEditMemberProfile(actor, { id: target.id, familyRole: target.familyRole })) {
        return { ok: false, error: 'forbidden' };
      }

      const patch: Partial<typeof users.$inferInsert> = {};

      if (parsed.data.displayName !== undefined) {
        const trimmed = parsed.data.displayName.trim();
        patch.displayName = trimmed.length > 0 ? trimmed : null;
      }
      if (parsed.data.kinshipLabel !== undefined) {
        patch.kinshipLabel = parsed.data.kinshipLabel === '' ? null : parsed.data.kinshipLabel;
      }
      if (parsed.data.profileSex !== undefined) {
        patch.profileSex = parsed.data.profileSex;
      }
      if (parsed.data.birthDate !== undefined) {
        patch.birthDate = parsed.data.birthDate === '' ? null : parsed.data.birthDate;
      }
      if (parsed.data.familyRole !== undefined) {
        if (!canChangeMemberRole(actor)) {
          return { ok: false, error: 'forbidden' };
        }
        if (target.familyRole === 'owner') {
          return { ok: false, error: 'cannot_change_owner_role' };
        }
        if (parsed.data.familyRole === 'owner') {
          return { ok: false, error: 'use_transfer_ownership' };
        }
        patch.familyRole = parsed.data.familyRole;
      }

      if (Object.keys(patch).length === 0) {
        return { ok: true };
      }

      await db.update(users).set(patch).where(eq(users.id, target.id));
      revalidateFamilyDashboard(clerkUserId);
      return { ok: true };
    });
  } catch (error) {
    console.error('updateMemberProfile failed', {
      message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    });
    return { ok: false, error: 'db_unavailable' };
  }
}

const transferOwnershipSchema = z.object({
  newOwnerMemberId: z.coerce.number().int().positive(),
});

export async function transferFamilyOwnership(
  input: z.infer<typeof transferOwnershipSchema>,
): Promise<ProfileActionResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'not_authenticated' };
  }

  const parsed = transferOwnershipSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor || actor.familyRole !== 'owner') {
      return { ok: false, error: 'forbidden' };
    }

    return await withDbRetry(async () => {
      const [target] = await db
        .select({ id: users.id, familyRole: users.familyRole, clerkId: users.clerkId })
        .from(users)
        .where(and(eq(users.id, parsed.data.newOwnerMemberId), eq(users.familyId, actor.familyId)))
        .limit(1);

      if (!target?.familyRole) {
        return { ok: false, error: 'member_not_found' };
      }

      if (!canTransferOwnership(actor, { id: target.id, familyRole: target.familyRole })) {
        return { ok: false, error: 'forbidden' };
      }

      await db.transaction(async (tx) => {
        await tx
          .update(families)
          .set({ ownerId: target.id })
          .where(eq(families.id, actor.familyId));
        await tx
          .update(users)
          .set({ familyRole: 'adult' })
          .where(eq(users.id, actor.userId));
        await tx
          .update(users)
          .set({ familyRole: 'owner' })
          .where(eq(users.id, target.id));
      });

      revalidateFamilyDashboard(clerkUserId, [target.clerkId]);
      return { ok: true };
    });
  } catch (error) {
    console.error('transferFamilyOwnership failed', {
      message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    });
    return { ok: false, error: 'db_unavailable' };
  }
}

const removeMemberSchema = z.object({
  memberId: z.coerce.number().int().positive(),
});

export async function removeFamilyMember(
  input: z.infer<typeof removeMemberSchema>,
): Promise<ProfileActionResult> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'not_authenticated' };
  }

  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const actor = await loadActor(clerkUserId);
    if (!actor || actor.familyRole !== 'owner') {
      return { ok: false, error: 'forbidden' };
    }

    return await withDbRetry(async () => {
      const [target] = await db
        .select({
          id: users.id,
          familyRole: users.familyRole,
          clerkId: users.clerkId,
        })
        .from(users)
        .where(and(eq(users.id, parsed.data.memberId), eq(users.familyId, actor.familyId)))
        .limit(1);

      if (!target?.familyRole) {
        return { ok: false, error: 'member_not_found' };
      }

      if (!canRemoveMember(actor, { id: target.id, familyRole: target.familyRole })) {
        return { ok: false, error: 'forbidden' };
      }

      await db
        .update(users)
        .set({ familyId: null, familyRole: null })
        .where(eq(users.id, target.id));

      revalidateFamilyDashboard(clerkUserId, [target.clerkId]);
      return { ok: true };
    });
  } catch (error) {
    console.error('removeFamilyMember failed', {
      message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    });
    return { ok: false, error: 'db_unavailable' };
  }
}
