import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { listVisibleTasks } from '@/features/tasks/list-tasks';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { users } from '@/lib/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_MS = 2_500;
const MAX_MS = 55_000;

/**
 * Lightweight SSE “cable”: polls assignment changes for the signed-in user.
 * Not Rails ActionCable — same UX idea over Server-Sent Events.
 */
export async function GET(request: Request): Promise<Response> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const context = await withDbRetry(async () => {
    const [dbUser] = await db
      .select({ id: users.id, familyId: users.familyId })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    return dbUser?.familyId ? { userId: dbUser.id, familyId: dbUser.familyId } : null;
  });

  if (!context) {
    return new Response('No family', { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const started = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown): void => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let lastFingerprint = '';

      const tick = async (): Promise<void> => {
        if (closed) return;
        if (Date.now() - started > MAX_MS) {
          send('reconnect', { reason: 'timeout' });
          closed = true;
          controller.close();
          return;
        }

        try {
          const tasks = await listVisibleTasks({
            familyId: context.familyId,
            userId: context.userId,
            scope: 'active',
          });
          const fingerprint = tasks
            .map((task) => `${task.id}:${task.myAssignment?.status ?? 'c'}:${task.dueAt ?? ''}`)
            .join('|');

          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint;
            send('tasks', { tasks });
          } else {
            send('ping', { at: new Date().toISOString() });
          }
        } catch {
          send('ping', { at: new Date().toISOString(), error: true });
        }

        if (!closed) {
          setTimeout(() => {
            void tick();
          }, POLL_MS);
        }
      };

      send('hello', { ok: true });
      void tick();

      request.signal.addEventListener('abort', () => {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
