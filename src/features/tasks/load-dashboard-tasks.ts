'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { listVisibleTasks, type VisibleTask } from '@/features/tasks/list-tasks';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';

export async function loadDashboardActiveTasks(): Promise<VisibleTask[]> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return [];
  }

  const ctx = await withDbRetry(async () => {
    const [dbUser] = await db
      .select({ id: users.id, familyId: users.familyId })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    return dbUser?.familyId ? { userId: dbUser.id, familyId: dbUser.familyId } : null;
  });

  if (!ctx) {
    return [];
  }

  return listVisibleTasks({
    familyId: ctx.familyId,
    userId: ctx.userId,
    scope: 'active',
  });
}
