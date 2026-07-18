'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { families, users } from '@/lib/server/db/schema';
import { generateInviteCode } from '@/lib/server/utils';
import { revalidatePath } from 'next/cache';

/**
 * Creates a new family and sets the current user as its owner.
 * Throws if the user is not authenticated or already belongs to a family.
 */
export async function createFamily(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Not authenticated');
  }

  const name = formData.get('name') as string;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Family name is required');
  }

  // Check user doesn't already belong to a family
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.familyId) {
    throw new Error('You already belong to a family');
  }

  const inviteCode = generateInviteCode();

  // Create the family with the user as owner
  const [family] = await db
    .insert(families)
    .values({
      name: name.trim(),
      ownerId: user.id,
      inviteCode,
    })
    .returning();

  // Update the user's family membership
  await db
    .update(users)
    .set({ familyId: family.id, familyRole: 'owner' })
    .where(eq(users.clerkId, userId));

  revalidatePath('/[locale]/dashboard', 'page');
}

/**
 * Joins an existing family using an invite code.
 * Throws if the user is not authenticated, the code is invalid,
 * or the user already belongs to a family.
 */
export async function joinFamily(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Not authenticated');
  }

  const inviteCode = formData.get('inviteCode') as string;
  if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
    throw new Error('Invite code is required');
  }

  // Check user doesn't already belong to a family
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.familyId) {
    throw new Error('You already belong to a family');
  }

  // Find family by invite code
  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.inviteCode, inviteCode.trim().toUpperCase()))
    .limit(1);

  if (!family) {
    throw new Error('Invalid invite code');
  }

  // Join the family as an adult member
  await db
    .update(users)
    .set({ familyId: family.id, familyRole: 'adult' })
    .where(eq(users.clerkId, userId));

  revalidatePath('/[locale]/dashboard', 'page');
}
