import { clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { invalidateDashboardFamilyCache } from '@/features/family/family-cache';
import { db } from '@/lib/server/db';
import { users } from '@/lib/server/db/schema';

export type DbUser = typeof users.$inferSelect;

function primaryEmail(clerkUser: {
  emailAddresses: { emailAddress: string }[];
}): string {
  return clerkUser.emailAddresses[0]?.emailAddress ?? '';
}

function displayName(clerkUser: {
  firstName: string | null;
  lastName: string | null;
  emailAddresses: { emailAddress: string }[];
}): string {
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');
  return name || primaryEmail(clerkUser);
}

/**
 * Keeps the Postgres users row aligned with the active Clerk session.
 *
 * Webhooks do not reach localhost, and Clerk Dev can issue a new user id for the
 * same email after re-sign-up. Re-link by verified email so existing family_id
 * membership is not lost.
 *
 * Callers must wrap Postgres-heavy follow-up in withDbRetry themselves — do not
 * nest withDbRetry here (global mutex deadlock).
 */
export async function ensureDbUser(clerkUserId: string): Promise<DbUser | null> {
  const [existingByClerk] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (existingByClerk) {
    return existingByClerk;
  }

  let clerkUser;
  try {
    const client = await clerkClient();
    clerkUser = await client.users.getUser(clerkUserId);
  } catch (error) {
    console.error('ensureDbUser: failed to load Clerk user', {
      clerkUserId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }

  const email = primaryEmail(clerkUser);
  if (!email) {
    return null;
  }

  const name = displayName(clerkUser);
  const avatarUrl = clerkUser.imageUrl ?? null;

  const [existingByEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingByEmail) {
    const [linked] = await db
      .update(users)
      .set({ clerkId: clerkUserId, name, avatarUrl })
      .where(eq(users.id, existingByEmail.id))
      .returning();

    console.info('ensureDbUser: re-linked Clerk id for existing email', {
      email,
      previousClerkId: existingByEmail.clerkId,
      clerkUserId,
      familyId: linked.familyId,
    });

    invalidateDashboardFamilyCache(clerkUserId);
    invalidateDashboardFamilyCache(existingByEmail.clerkId);

    return linked;
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkId: clerkUserId,
      email,
      name,
      avatarUrl,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    return created;
  }

  const [raceWinner] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  return raceWinner ?? null;
}
