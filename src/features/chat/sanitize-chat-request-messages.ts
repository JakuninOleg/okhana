export type ChatRequestMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * Drop blank bubbles before POST /api/chat.
 * Empty assistant placeholders from a prior failed/empty stream would otherwise
 * fail Zod `content.min(1)` and surface as "Invalid chat payload".
 */
export function sanitizeChatRequestMessages(
  messages: ReadonlyArray<{ role: string; content: string }>,
): ChatRequestMessage[] {
  const allowed = new Set(['user', 'assistant']);
  return messages
    .filter((message) => allowed.has(message.role) && message.content.trim().length > 0)
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    }));
}
