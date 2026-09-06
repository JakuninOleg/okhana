'use server';

import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';

export type QuietHoursActionError = 'unauthorized' | 'invalid_input' | 'db_unavailable';

export async function loadQuietHoursAction(): Promise<
  { ok: true; enabled: boolean } | { ok: false; error: QuietHoursActionError }
> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }
  try {
    const user = await ensureDbUser(clerkUserId);
    if (!user) {
      return { ok: false, error: 'unauthorized' };
    }
    return { ok: true, enabled: user.quietHoursEnabled };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}

const setSchema = z.object({
  enabled: z.boolean(),
});

export async function setQuietHoursAction(
  input: z.infer<typeof setSchema>,
): Promise<{ ok: true; enabled: boolean } | { ok: false; error: QuietHoursActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }
  try {
    const user = await ensureDbUser(clerkUserId);
    if (!user) {
      return { ok: false, error: 'unauthorized' };
    }
    await withDbRetry(async () => {
      await db
        .update(users)
        .set({ quietHoursEnabled: parsed.data.enabled })
        .where(eq(users.id, user.id));
    });
    revalidatePath('/[locale]/dashboard', 'page');
    return { ok: true, enabled: parsed.data.enabled };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}
