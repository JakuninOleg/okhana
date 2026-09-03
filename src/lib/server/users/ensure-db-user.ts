import { clerkClient } from '@clerk/nextjs/server';
import { and, eq, ne } from 'drizzle-orm';
import { invalidateDashboardFamilyCache } from '@/features/family/family-cache';
import { withDbRetry } from '@/lib/server/db/client';
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

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    if ('code' in current && String(current.code) === '23505') {
      return true;
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

/**
 * Clerk Dev can create a stub users row (new clerk_id, no family) before we
 * re-link the canonical email row. Remove it so clerk_id can move to family row.
 */
async function clearOrphanClerkStub(
  clerkUserId: string,
  canonicalUserId: number,
): Promise<void> {
  const [stub] = await db
    .select({ id: users.id, familyId: users.familyId })
    .from(users)
    .where(and(eq(users.clerkId, clerkUserId), ne(users.id, canonicalUserId)))
    .limit(1);

  if (!stub || stub.familyId != null) {
    return;
  }

  await db.delete(users).where(eq(users.id, stub.id));
}

async function selectUserByClerkId(clerkUserId: string): Promise<DbUser | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  return row ?? null;
}

/**
 * Keeps the Postgres users row aligned with the active Clerk session.
 *
 * Webhooks do not reach localhost, and Clerk Dev can issue a new user id for the
 * same email after re-sign-up. Re-link by verified email so existing family_id
 * membership is not lost.
 *
 * Uses withDbRetry for SQL only. Clerk API stays outside the DB mutex so a slow
 * Clerk round-trip cannot burn the query deadline or nest mutex locks.
 */
export async function ensureDbUser(clerkUserId: string): Promise<DbUser | null> {
  const existingByClerk = await withDbRetry(async () => {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    return row ?? null;
  });

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

  return withDbRetry(async () => {
    const [existingByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingByEmail) {
      await clearOrphanClerkStub(clerkUserId, existingByEmail.id);

      let linked: DbUser | undefined;
      try {
        [linked] = await db
          .update(users)
          .set({ clerkId: clerkUserId, name, avatarUrl })
          .where(eq(users.id, existingByEmail.id))
          .returning();
      } catch (error) {
        if (isUniqueViolation(error)) {
          const byClerk = await selectUserByClerkId(clerkUserId);
          if (byClerk) {
            invalidateDashboardFamilyCache(clerkUserId);
            invalidateDashboardFamilyCache(existingByEmail.clerkId);
            return byClerk;
          }
        }
        throw error;
      }

      if (!linked) {
        linked = (await selectUserByClerkId(clerkUserId)) ?? existingByEmail;
      }

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
  });
}
