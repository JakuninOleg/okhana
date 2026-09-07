import { auth } from '@clerk/nextjs/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { coerceChatRequestBody } from '@/app/api/chat/coerce-chat-request-body';
import { createChatWithToolsStream, EMPTY_ASSISTANT_FALLBACK } from '@/features/ai/chat-with-tools';
import { getGoAiConfig } from '@/features/ai/go-ai-client';
import type { GoAiMessage } from '@/features/ai/go-ai-types';
import { buildSystemPrompt } from '@/features/ai/system-prompt';
import {
  getCachedChatContext,
  setCachedChatContext,
  type CachedChatContext,
} from '@/features/chat/chat-context-cache';
import { listKinshipLabelsForViewer } from '@/features/family/member-kinship';
import { routing, type Locale } from '@/i18n/routing';
import { consumeDailyChatQuota, chatQuotaSnapshotFromConsume } from '@/lib/server/ai-usage-quota';
import { db } from '@/lib/server/db';
import { withDbRetry } from '@/lib/server/db/client';
import { aiChatMessages, aiConversations, users } from '@/lib/server/db/schema';
import { consumeRateLimit } from '@/lib/server/rate-limit';

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
  /** Device-local ISO-8601 datetime (with offset) for relative deadlines in chat. */
  clientNow: z.string().datetime({ offset: true }).optional(),
  timeZone: z.string().min(1).max(100).optional(),
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

    const familyMembersRaw = await db
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

    const viewerKinship = await listKinshipLabelsForViewer({
      familyId: dbUser.familyId,
      viewerUserId: dbUser.id,
    });

    const familyMembers = familyMembersRaw.map((member) => ({
      ...member,
      kinshipLabel: viewerKinship.get(member.id) ?? null,
    }));

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

  const rate = consumeRateLimit({
    key: `chat:${clerkUserId}`,
    limit: 40,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
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

  const parsedBody = chatRequestSchema.safeParse(coerceChatRequestBody(rawBody));
  if (!parsedBody.success) {
    return Response.json({ error: 'Invalid chat payload' }, { status: 400 });
  }

  // Prefer cache; if cold, load membership before Go-Ai so daily quotas can run.
  let context = contextFromCache(clerkUserId);
  if (!context) {
    try {
      context = await loadChatContextFromDb(clerkUserId);
    } catch {
      return Response.json({ error: 'no_family' }, { status: 403 });
    }
  }

  let quota;
  try {
    quota = await consumeDailyChatQuota({
      familyId: context.familyId,
      userId: context.userId,
    });
  } catch (error) {
    console.error('chat daily quota failed', {
      message: error instanceof Error ? error.message.slice(0, 120) : 'unknown',
    });
    return Response.json({ error: 'quota_unavailable' }, { status: 503 });
  }

  if (!quota.ok) {
    const retryAfterSec = 60 * 60;
    return Response.json(
      {
        error: quota.reason,
        familyLimit: quota.familyLimit,
        userLimit: quota.userLimit,
        usageDate: quota.usageDate,
      },
      {
        status: quota.reason === 'disabled' ? 503 : 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      },
    );
  }

  const { locale, messages: requestMessages, clientNow, timeZone } = parsedBody.data;
  const lastUserMessage = [...requestMessages].reverse().find((message) => message.role === 'user');
  const lastUserText = lastUserMessage?.content.trim() ?? '';

  const modelMessages: GoAiMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        locale: locale as Locale,
        familyRole: context.familyRole,
        familyMembers: context.familyMembers,
        isNewConversation: context.isNewConversation,
        clientNow: clientNow ?? null,
        timeZone: timeZone ?? null,
      }),
    },
    ...requestMessages.slice(-MAX_MODEL_CONTEXT_MESSAGES).map((message) => ({
      role: message.role,
      content: truncateText(message.content, MAX_MESSAGE_CHARS),
    })),
  ];

  const streamResponse = createChatWithToolsStream({
    messages: modelMessages,
    emptyAssistantFallback: locale === 'ru'
      ? 'Охана не вернула ответ. Попробуйте ещё раз.'
      : EMPTY_ASSISTANT_FALLBACK,
    toolContext: {
      familyId: context.familyId,
      userId: context.userId,
      familyRole: context.familyRole,
      clientNow: clientNow ?? null,
    },
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

  const snapshot = chatQuotaSnapshotFromConsume(quota);
  const headers = new Headers(streamResponse.headers);
  headers.set('X-Okhana-Quota-Remaining', String(snapshot.remaining));
  headers.set('X-Okhana-Quota-Family-Remaining', String(snapshot.familyRemaining));
  headers.set('X-Okhana-Quota-User-Remaining', String(snapshot.userRemaining));
  headers.set('X-Okhana-Quota-Family-Limit', String(snapshot.familyLimit));
  headers.set('X-Okhana-Quota-User-Limit', String(snapshot.userLimit));

  return new Response(streamResponse.body, {
    status: streamResponse.status,
    statusText: streamResponse.statusText,
    headers,
  });
}
