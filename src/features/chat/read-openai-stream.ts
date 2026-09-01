import { parseOpenAiSseData } from '@/features/ai/openai-sse';

/**
 * Consume an OpenAI-compatible SSE body from our `/api/chat` proxy.
 * Iterative only — never recurse on chunks (avoids call-stack blowups).
 */
export async function readOpenAiChatStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) {
            continue;
          }
          const data = line.slice('data:'.length).trim();
          if (data === '[DONE]') {
            return fullText;
          }
          const parsed = parseOpenAiSseData(data);
          if (parsed?.contentDelta) {
            fullText += parsed.contentDelta;
            onDelta(parsed.contentDelta);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
