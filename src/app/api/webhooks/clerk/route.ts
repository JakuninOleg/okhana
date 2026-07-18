import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { users } from '@/lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Get svix headers for signature verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('[clerk-webhook] Missing svix headers', {
      hasId: !!svix_id,
      hasTimestamp: !!svix_timestamp,
      hasSignature: !!svix_signature,
    });
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Get raw request body as text — signature must be verified against the exact raw bytes
  const body = await req.text();

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (e) {
    console.error('[clerk-webhook] Signature verification failed', e);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Extract user data from the verified event object (not raw JSON.parse)
  const { id: clerkId, email_addresses, first_name, last_name, image_url } = evt.data as {
    id: string;
    email_addresses: { email_address: string }[];
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
  const email = email_addresses?.[0]?.email_address as string;
  const name = [first_name, last_name].filter(Boolean).join(' ') || email;

  console.log(`[clerk-webhook] Received event: ${evt.type}`, { clerkId, email });

  // Handle Clerk events
  switch (evt.type) {
    case 'user.created': {
      try {
        await db.insert(users).values({
          clerkId,
          email,
          name,
          avatarUrl: image_url,
        }).onConflictDoNothing();
        console.log(`[clerk-webhook] User created in DB: ${clerkId}`);
      } catch (e) {
        console.error(`[clerk-webhook] Failed to insert user ${clerkId}:`, e);
        throw e;
      }
      break;
    }

    case 'user.updated': {
      try {
        await db.update(users)
          .set({ email, name, avatarUrl: image_url })
          .where(eq(users.clerkId, clerkId));
        console.log(`[clerk-webhook] User updated in DB: ${clerkId}`);
      } catch (e) {
        console.error(`[clerk-webhook] Failed to update user ${clerkId}:`, e);
        throw e;
      }
      break;
    }

    case 'user.deleted': {
      try {
        await db.delete(users).where(eq(users.clerkId, clerkId));
        console.log(`[clerk-webhook] User deleted from DB: ${clerkId}`);
      } catch (e) {
        console.error(`[clerk-webhook] Failed to delete user ${clerkId}:`, e);
        throw e;
      }
      break;
    }

    default:
      console.log(`[clerk-webhook] Unhandled event: ${evt.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
