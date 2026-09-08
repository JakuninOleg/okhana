'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { aiChatMessages, aiConversations } from '@/lib/server/db/schema';
import { ensureDbUser } from '@/lib/server/users/ensure-db-user';

export type ChatMessageActionError =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'db_unavailable';

async function loadOwnedUserMessage(input: {
  clerkUserId: string;
  messageId: number;
}): Promise<
  | { ok: true; messageId: number; conversationId: number }
  | { ok: false; error: ChatMessageActionError }
> {
  const actor = await ensureDbUser(input.clerkUserId);
  if (!actor) {
    return { ok: false, error: 'unauthorized' };
  }

  return withDbRetry(async () => {
    const [row] = await db
      .select({
        messageId: aiChatMessages.id,
        conversationId: aiChatMessages.conversationId,
        role: aiChatMessages.role,
        deletedAt: aiChatMessages.deletedAt,
        ownerUserId: aiConversations.userId,
      })
      .from(aiChatMessages)
      .innerJoin(aiConversations, eq(aiChatMessages.conversationId, aiConversations.id))
      .where(and(
        eq(aiChatMessages.id, input.messageId),
        eq(aiConversations.userId, actor.id),
        isNull(aiChatMessages.deletedAt),
      ))
      .limit(1);

    if (!row) {
      return { ok: false, error: 'not_found' };
    }
    if (row.role !== 'user' || row.ownerUserId !== actor.id) {
      return { ok: false, error: 'forbidden' };
    }
    return { ok: true, messageId: row.messageId, conversationId: row.conversationId };
  });
}

const editSchema = z.object({
  messageId: z.coerce.number().int().positive(),
  content: z.string().trim().min(1).max(8000),
});

export async function editOwnChatMessageAction(
  input: z.infer<typeof editSchema>,
): Promise<{ ok: true; content: string } | { ok: false; error: ChatMessageActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const owned = await loadOwnedUserMessage({
      clerkUserId,
      messageId: parsed.data.messageId,
    });
    if (!owned.ok) {
      return owned;
    }

    const now = new Date();
    await withDbRetry(async () => {
      await db
        .update(aiChatMessages)
        .set({ content: parsed.data.content, updatedAt: now })
        .where(and(
          eq(aiChatMessages.id, owned.messageId),
          isNull(aiChatMessages.deletedAt),
        ));
      await db
        .update(aiConversations)
        .set({ updatedAt: now })
        .where(eq(aiConversations.id, owned.conversationId));
    });

    return { ok: true, content: parsed.data.content };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}

const deleteSchema = z.object({
  messageId: z.coerce.number().int().positive(),
});

export async function deleteOwnChatMessageAction(
  input: z.infer<typeof deleteSchema>,
): Promise<{ ok: true } | { ok: false; error: ChatMessageActionError }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  try {
    const owned = await loadOwnedUserMessage({
      clerkUserId,
      messageId: parsed.data.messageId,
    });
    if (!owned.ok) {
      return owned;
    }

    const now = new Date();
    await withDbRetry(async () => {
      await db
        .update(aiChatMessages)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(aiChatMessages.id, owned.messageId));
      await db
        .update(aiConversations)
        .set({ updatedAt: now })
        .where(eq(aiConversations.id, owned.conversationId));
    });

    return { ok: true };
  } catch {
    return { ok: false, error: 'db_unavailable' };
  }
}
