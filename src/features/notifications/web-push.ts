import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { pushSubscriptions } from '@/lib/server/db/schema';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** Known Web Push provider hosts — blocks SSRF via attacker-controlled endpoints. */
const PUSH_ENDPOINT_HOST_PATTERNS: RegExp[] = [
  /^fcm\.googleapis\.com$/i,
  /^android\.googleapis\.com$/i,
  /^updates\.push\.services\.mozilla\.com$/i,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/i,
  /^web\.push\.apple\.com$/i,
  /^[a-z0-9-]+\.push\.apple\.com$/i,
  /^[a-z0-9.-]+\.notify\.windows\.com$/i,
];

/**
 * Accept only https push provider URLs (no IP literals / private hosts).
 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') {
    return false;
  }
  if (url.port && url.port !== '443') {
    return false;
  }
  // Reject IPv4 / IPv6 literals (SSRF to metadata / internal nets).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.includes(':')) {
    return false;
  }
  return PUSH_ENDPOINT_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
}

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  // Server-only: browser gets the public key via GET /api/push/subscribe (not NEXT_PUBLIC_*).
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@okhanahome.com';
  if (!publicKey || !privateKey) {
    return null;
  }
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string | null {
  return getVapidConfig()?.publicKey ?? null;
}

export async function upsertPushSubscription(input: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  if (!isAllowedPushEndpoint(input.endpoint)) {
    throw new Error('Invalid push endpoint');
  }

  await withDbRetry(async () => {
    const existing = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, input.endpoint))
      .limit(1);

    if (existing[0]) {
      await db
        .update(pushSubscriptions)
        .set({
          userId: input.userId,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing[0].id));
      return;
    }

    await db.insert(pushSubscriptions).values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    });
  });
}

/** Best-effort Web Push to family members (skips when VAPID is unset). */
export async function sendPushToUsers(
  userIds: number[],
  payload: PushPayload,
): Promise<void> {
  const vapid = getVapidConfig();
  if (!vapid || userIds.length === 0) {
    return;
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const uniqueIds = [...new Set(userIds)];
  const rows = await withDbRetry(async () =>
    db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, uniqueIds)),
  );

  const body = JSON.stringify(payload);
  await Promise.all(
    rows.map(async (row) => {
      if (!isAllowedPushEndpoint(row.endpoint)) {
        await withDbRetry(async () => {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
        });
        return;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body,
        );
      } catch (error) {
        const status = typeof error === 'object' && error && 'statusCode' in error
          ? Number((error as { statusCode?: number }).statusCode)
          : null;
        // Gone / expired subscription — drop it.
        if (status === 404 || status === 410) {
          await withDbRetry(async () => {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
          });
        }
      }
    }),
  );
}
