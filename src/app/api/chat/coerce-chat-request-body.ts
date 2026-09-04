/**
 * Strip blank chat turns from a raw POST body so a prior empty assistant bubble
 * does not fail Zod and cascade into "Invalid chat payload".
 */
export function coerceChatRequestBody(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.messages)) {
    return raw;
  }

  const messages = body.messages.filter((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return false;
    }
    const message = entry as { role?: unknown; content?: unknown };
    if (message.role !== 'user' && message.role !== 'assistant') {
      return false;
    }
    return typeof message.content === 'string' && message.content.trim().length > 0;
  });

  return { ...body, messages };
}
