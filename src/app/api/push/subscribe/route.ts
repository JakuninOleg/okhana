import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getVapidPublicKey, upsertPushSubscription } from '@/features/notifications/web-push';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';

export const runtime = 'nodejs';

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export async function GET(): Promise<Response> {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }
  return NextResponse.json({ configured: true, publicKey });
}

export async function POST(request: Request): Promise<Response> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!getVapidPublicKey()) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const dbUser = await withDbRetry(async () => {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    return row ?? null;
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await upsertPushSubscription({
    userId: dbUser.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true });
}
