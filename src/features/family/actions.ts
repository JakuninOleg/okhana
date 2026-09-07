'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { invalidateCachedChatContext } from '@/features/chat/chat-context-cache';
import { invalidateDashboardFamilyCache } from '@/features/family/get-dashboard-family';
import {
  canLeaveFamily,
  canRotateInviteCode,
} from '@/features/family/profile-permissions';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { families, users } from '@/lib/server/db/schema';
import { consumeRateLimit } from '@/lib/server/rate-limit';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';
import { generateInviteCode } from '@/lib/server/utils';

export type FamilyActionResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidateActor(clerkUserId: string): void {
  invalidateDashboardFamilyCache(clerkUserId);
  invalidateCachedChatContext(clerkUserId);
  revalidatePath('/[locale]/dashboard', 'page');
}

/**
 * Creates a new family and sets the current user as its owner.
 */
export async function createFamily(formData: FormData): Promise<FamilyActionResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: 'not_authenticated' };
  }

  const name = formData.get('name');
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { ok: false, error: 'family_name_required' };
  }

  const user = await ensureDbUser(userId);
  if (!user) {
    return { ok: false, error: 'user_not_found' };
  }
  if (user.familyId) {
    return { ok: false, error: 'already_in_family' };
  }

  try {
    const inviteCode = generateInviteCode();

    await withDbRetry(async () => {
      const [family] = await db
        .insert(families)
        .values({
          name: name.trim(),
          ownerId: user.id,
          inviteCode,
        })
        .returning();

      await db
        .update(users)
        .set({ familyId: family.id, familyRole: 'owner' })
        .where(eq(users.clerkId, userId));
    });

    revalidateActor(userId);
    return { ok: true };
  } catch (error) {
    console.error('createFamily failed', {
      message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    });
    return { ok: false, error: 'db_unavailable' };
  }
}

/**
 * Joins an existing family using an invite code.
 */
export async function joinFamily(formData: FormData): Promise<FamilyActionResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: 'not_authenticated' };
  }

  const inviteCode = formData.get('inviteCode');
  if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
    return { ok: false, error: 'invite_code_required' };
  }

  const rate = consumeRateLimit({
    key: `join-family:${userId}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.ok) {
    return { ok: false, error: 'rate_limited' };
  }

  const user = await ensureDbUser(userId);
  if (!user) {
    return { ok: false, error: 'user_not_found' };
  }
  if (user.familyId) {
    return { ok: false, error: 'already_in_family' };
  }

  try {
    const joined = await withDbRetry(async () => {
      const [family] = await db
        .select()
        .from(families)
        .where(eq(families.inviteCode, inviteCode.trim().toUpperCase()))
        .limit(1);

      if (!family) {
        return false;
      }

      await db
        .update(users)
        .set({ familyId: family.id, familyRole: 'adult' })
        .where(eq(users.clerkId, userId));
      return true;
    });

    if (!joined) {
      return { ok: false, error: 'invalid_invite_code' };
    }

    revalidateActor(userId);
    return { ok: true };
  } catch (error) {
    console.error('joinFamily failed', {
      message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    });
    return { ok: false, error: 'db_unavailable' };
  }
}

/** Owner rotates invite code so an old shared code stops working. */
export async function rotateInviteCode(): Promise<FamilyActionResult & { inviteCode?: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: 'not_authenticated' };
  }

  const user = await ensureDbUser(userId);
  if (!user?.familyId || !user.familyRole) {
    return { ok: false, error: 'no_family' };
  }
  if (!canRotateInviteCode({ userId: user.id, familyRole: user.familyRole })) {
    return { ok: false, error: 'forbidden' };
  }

  try {
    const nextCode = generateInviteCode();
    const updated = await withDbRetry(async () => {
      const [row] = await db
        .update(families)
        .set({ inviteCode: nextCode })
        .where(and(eq(families.id, user.familyId!), eq(families.ownerId, user.id)))
        .returning({ inviteCode: families.inviteCode });
      return row?.inviteCode ?? null;
    });

    if (!updated) {
      return { ok: false, error: 'forbidden' };
    }

    revalidateActor(userId);
    return { ok: true, inviteCode: updated };
  } catch (error) {
    console.error('rotateInviteCode failed', {
      message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    });
    return { ok: false, error: 'db_unavailable' };
  }
}

/** Non-owner leaves the family. Owner must transfer ownership first. */
export async function leaveFamily(): Promise<FamilyActionResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: 'not_authenticated' };
  }

  const user = await ensureDbUser(userId);
  if (!user?.familyId || !user.familyRole) {
    return { ok: false, error: 'no_family' };
  }
  if (!canLeaveFamily({ userId: user.id, familyRole: user.familyRole })) {
    return { ok: false, error: 'owner_must_transfer' };
  }

  try {
    await withDbRetry(async () => {
      await db
        .update(users)
        .set({ familyId: null, familyRole: null })
        .where(and(eq(users.id, user.id), eq(users.familyId, user.familyId!)));
    });

    revalidateActor(userId);
    return { ok: true };
  } catch (error) {
    console.error('leaveFamily failed', {
      message: error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    });
    return { ok: false, error: 'db_unavailable' };
  }
}
