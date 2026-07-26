import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { aiChatMessages, aiConversations, users } from '@/lib/server/db/schema';

export const runtime = 'nodejs';

const CHAT_HISTORY_LIMIT = 30;

export type ChatHistoryMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

export async function GET(): Promise<Response> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await withDbRetry(async () => {
      const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
      if (!dbUser) {
        return Response.json({ error: 'User not found' }, { status: 401 });
      }
      if (!dbUser.familyId) {
        return Response.json({ messages: [] satisfies ChatHistoryMessage[] });
      }

      const [conversation] = await db
        .select()
        .from(aiConversations)
        .where(and(eq(aiConversations.familyId, dbUser.familyId), eq(aiConversations.userId, dbUser.id)))
        .orderBy(desc(aiConversations.updatedAt))
        .limit(1);

      if (!conversation) {
        return Response.json({ messages: [] satisfies ChatHistoryMessage[] });
      }

      const latestMessages = await db
        .select({
          id: aiChatMessages.id,
          role: aiChatMessages.role,
          content: aiChatMessages.content,
          createdAt: aiChatMessages.createdAt,
        })
        .from(aiChatMessages)
        .where(eq(aiChatMessages.conversationId, conversation.id))
        .orderBy(desc(aiChatMessages.createdAt), desc(aiChatMessages.id))
        .limit(CHAT_HISTORY_LIMIT);

      const messages: ChatHistoryMessage[] = latestMessages.reverse().map((message) => ({
        id: String(message.id),
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      }));

      return Response.json({
        conversationId: conversation.id,
        messages,
      });
    });
  } catch (error) {
    // Hung pooler should not break the chat UI — start empty and continue.
    console.error('chat history load failed', {
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
    });
    return Response.json({ messages: [] satisfies ChatHistoryMessage[] });
  }
}
