import { clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { users } from '@/lib/server/db/schema';

/**
 * Ensures a user row exists in the Supabase `users` table for the given
 * Clerk userId. If the row is missing, it is created from Clerk API data.
 *
 * This is the ROBUST path — it does not rely on the Clerk webhook having
 * fired successfully. Webhooks can fail silently (misconfigured endpoint,
 * wrong secret, network drop, production instance not set up), and without
 * a DB row the user cannot create or join a family (foreign-key constraints
 * fail). By upserting on read, the app degrades gracefully: the webhook
 * becomes an optimisation, not a critical-path dependency.
 *
 * Returns the user's email so the caller can use it without a second
 * Clerk API round-trip.
 */
export async function ensureUserExists(clerkUserId: string): Promise<{
  email: string;
  name: string | null;
  avatarUrl: string | null;
}> {
  // Check if the user already exists in the DB.
  const [existing] = await db
    .select({ email: users.email, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (existing) {
    return existing;
  }

  // User not in DB — fetch from Clerk API and insert.
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email;
  const avatarUrl = clerkUser.imageUrl ?? null;

  await db
    .insert(users)
    .values({
      clerkId: clerkUserId,
      email,
      name,
      avatarUrl,
    })
    .onConflictDoNothing();

  return { email, name, avatarUrl };
}
