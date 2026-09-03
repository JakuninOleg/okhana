import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createChatWithToolsStream } from '@/features/ai/chat-with-tools';
import { getGoAiConfig } from '@/features/ai/go-ai-client';
import type { GoAiMessage } from '@/features/ai/go-ai-types';
import { buildSystemPrompt } from '@/features/ai/system-prompt';
import {
  getCachedChatContext,
  setCachedChatContext,
  type CachedChatContext,
} from '@/features/chat/chat-context-cache';
import { routing, type Locale } from '@/i18n/routing';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { aiChatMessages, aiConversations, users } from '@/lib/server/db/schema';

export const runtime = 'nodejs';

const MAX_REQUEST_MESSAGES = 50;
const MAX_MODEL_CONTEXT_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_STORED_MESSAGE_CHARS = 12_000;

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(MAX_MESSAGE_CHARS),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(MAX_REQUEST_MESSAGES),
  locale: z.enum(routing.locales).catch(routing.defaultLocale),
});

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

type ChatContextOk = {
  familyId: number;
  userId: number;
  familyRole: NonNullable<typeof users.$inferSelect.familyRole>;
  conversationId: number | null;
  isNewConversation: boolean;
  familyMembers: Array<{
    id: number;
    name: string | null;
    email: string;
    role: typeof users.$inferSelect.familyRole;
    kinshipLabel: string | null;
    birthDate: string | null;
  }>;
};

function contextFromCache(clerkUserId: string): ChatContextOk | null {
  const cached = getCachedChatContext(clerkUserId);
  if (!cached) {
    return null;
  }
  return {
    familyId: cached.familyId,
    userId: cached.userId,
    familyRole: cached.familyRole,
    conversationId: cached.conversationId,
    isNewConversation: cached.isNewConversation,
    familyMembers: cached.familyMembers,
  };
}

async function loadChatContextFromDb(clerkUserId: string): Promise<ChatContextOk> {
  return withDbRetry(async () => {
    const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (!dbUser?.familyId || !dbUser.familyRole) {
      throw new Error(dbUser ? 'User does not belong to a family' : 'User not found');
    }

    const familyMembers = await db
      .select({
        id: users.id,
        name: users.displayName,
        email: users.email,
        role: users.familyRole,
        kinshipLabel: users.kinshipLabel,
        birthDate: users.birthDate,
      })
      .from(users)
      .where(eq(users.familyId, dbUser.familyId));

    const [existingConversation] = await db
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.familyId, dbUser.familyId), eq(aiConversations.userId, dbUser.id)))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(1);

    const conversation = existingConversation ?? (await db
      .insert(aiConversations)
      .values({ familyId: dbUser.familyId, userId: dbUser.id, title: 'AI chat' })
      .returning())[0];

    const context: ChatContextOk = {
      familyId: dbUser.familyId,
      userId: dbUser.id,
      familyRole: dbUser.familyRole,
      conversationId: conversation.id,
      isNewConversation: !existingConversation,
      familyMembers,
    };

    setCachedChatContext(clerkUserId, {
      familyId: context.familyId,
      userId: context.userId,
      familyRole: context.familyRole,
      conversationId: context.conversationId,
      isNewConversation: context.isNewConversation,
      familyMembers: context.familyMembers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        kinshipLabel: member.kinshipLabel,
        birthDate: member.birthDate,
      })),
    } satisfies Omit<CachedChatContext, 'cachedAt'>);

    return context;
  });
}

async function persistTurn(input: {
  clerkUserId: string;
  familyId: number;
  userId: number;
  conversationId: number | null;
  lastUserText: string;
  assistantText: string;
}): Promise<void> {
  await withDbRetry(async () => {
    let conversationId = input.conversationId;
    if (conversationId == null) {
      const [existingConversation] = await db
        .select()
        .from(aiConversations)
        .where(and(
          eq(aiConversations.familyId, input.familyId),
          eq(aiConversations.userId, input.userId),
        ))
        .orderBy(desc(aiConversations.updatedAt))
        .limit(1);
      conversationId = existingConversation?.id ?? (await db
        .insert(aiConversations)
        .values({ familyId: input.familyId, userId: input.userId, title: 'AI chat' })
        .returning())[0].id;

      const cached = getCachedChatContext(input.clerkUserId);
      if (cached) {
        setCachedChatContext(input.clerkUserId, { ...cached, conversationId, isNewConversation: false });
      }
    }

    const now = new Date();
    if (input.lastUserText) {
      await db.insert(aiChatMessages).values({
        conversationId,
        role: 'user',
        content: truncateText(input.lastUserText, MAX_STORED_MESSAGE_CHARS),
      });
    }
    if (input.assistantText.trim()) {
      await db.insert(aiChatMessages).values({
        conversationId,
        role: 'assistant',
        content: truncateText(input.assistantText.trim(), MAX_STORED_MESSAGE_CHARS),
      });
    }
    await db
      .update(aiConversations)
      .set({ updatedAt: now })
      .where(eq(aiConversations.id, conversationId));
  });
}

export async function POST(request: Request): Promise<Response> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    getGoAiConfig();
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid chat payload' }, { status: 400 });
  }

  const parsedBody = chatRequestSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return Response.json({ error: 'Invalid chat payload' }, { status: 400 });
  }

  // Hot path: memory cache only. Never wait on Supabase before the first Go-Ai token.
  const context = contextFromCache(clerkUserId);
  if (!context) {
    void loadChatContextFromDb(clerkUserId).catch(() => undefined);
  }

  const { locale, messages: requestMessages } = parsedBody.data;
  const lastUserMessage = [...requestMessages].reverse().find((message) => message.role === 'user');
  const lastUserText = lastUserMessage?.content.trim() ?? '';

  const modelMessages: GoAiMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        locale: locale as Locale,
        familyRole: context?.familyRole ?? 'adult',
        familyMembers: context?.familyMembers ?? [],
        isNewConversation: context?.isNewConversation ?? !context,
      }),
    },
    ...requestMessages.slice(-MAX_MODEL_CONTEXT_MESSAGES).map((message) => ({
      role: message.role,
      content: truncateText(message.content, MAX_MESSAGE_CHARS),
    })),
  ];

  return createChatWithToolsStream({
    messages: modelMessages,
    toolContext: context
      ? {
        familyId: context.familyId,
        userId: context.userId,
        familyRole: context.familyRole,
      }
      : undefined,
    signal: request.signal,
    onComplete: async ({ text }) => {
      const latest = contextFromCache(clerkUserId) ?? context;
      if (!latest) {
        return;
      }
      try {
        await persistTurn({
          clerkUserId,
          familyId: latest.familyId,
          userId: latest.userId,
          conversationId: latest.conversationId,
          lastUserText,
          assistantText: text,
        });
      } catch {
        // Best-effort persistence — reply already streamed.
      }
    },
  });
}
