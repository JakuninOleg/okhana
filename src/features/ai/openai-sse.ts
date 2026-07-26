import type { GoAiToolCall } from '@/features/ai/go-ai-types';

export type AssembledStreamResult = {
  content: string;
  toolCalls: GoAiToolCall[];
  finishReason: string | null;
};

type ToolCallAccumulator = {
  id: string;
  name: string;
  arguments: string;
  /** Opaque provider metadata; never inspected — only forwarded. */
  extra_content?: unknown;
};

export type ToolCallDelta = {
  index: number;
  id?: string;
  name?: string;
  arguments?: string;
  extra_content?: unknown;
};

/**
 * Parse one OpenAI-compatible SSE `data:` payload (not including the `data:` prefix).
 * Returns null for `[DONE]` or unparsable keepalives.
 */
export function parseOpenAiSseData(data: string): {
  contentDelta: string;
  toolCallDeltas: ToolCallDelta[];
  finishReason: string | null;
} | null {
  const trimmed = data.trim();
  if (!trimmed || trimmed === '[DONE]') {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      choices?: Array<{
        finish_reason?: string | null;
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
            extra_content?: unknown;
          }>;
        };
      }>;
    };

    const choice = parsed.choices?.[0];
    if (!choice) {
      return null;
    }

    const toolCallDeltas = (choice.delta?.tool_calls ?? []).map((toolCall) => ({
      index: toolCall.index ?? 0,
      id: toolCall.id,
      name: toolCall.function?.name,
      arguments: toolCall.function?.arguments,
      // Pass through without reading or transforming the value.
      ...(toolCall.extra_content !== undefined
        ? { extra_content: toolCall.extra_content }
        : {}),
    }));

    return {
      contentDelta: choice.delta?.content ?? '',
      toolCallDeltas,
      finishReason: choice.finish_reason ?? null,
    };
  } catch {
    return null;
  }
}

export function accumulateToolCallDeltas(
  store: Map<number, ToolCallAccumulator>,
  deltas: ToolCallDelta[],
): void {
  for (const delta of deltas) {
    const existing = store.get(delta.index) ?? { id: '', name: '', arguments: '' };
    if (delta.id) {
      existing.id = delta.id;
    }
    if (delta.name) {
      existing.name += delta.name;
    }
    if (delta.arguments) {
      existing.arguments += delta.arguments;
    }
    // Keep first opaque blob; do not merge/parse subsequent chunks.
    if (delta.extra_content !== undefined && existing.extra_content === undefined) {
      existing.extra_content = delta.extra_content;
    }
    store.set(delta.index, existing);
  }
}

export function toolCallsFromAccumulator(store: Map<number, ToolCallAccumulator>): GoAiToolCall[] {
  return [...store.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, value]) => {
      const call: GoAiToolCall = {
        id: value.id || `call_${value.name || 'tool'}_${index}`,
        type: 'function',
        function: {
          name: value.name,
          arguments: value.arguments || '{}',
        },
      };
      if (value.extra_content !== undefined) {
        call.extra_content = value.extra_content;
      }
      return call;
    })
    .filter((call) => call.function.name.length > 0);
}

/**
 * Read an upstream OpenAI SSE body, optionally forwarding content deltas to `controller`.
 * Uses an iterative read loop (never recursion) so tool multi-steps cannot blow the stack.
 */
export async function assembleOpenAiSseStream(
  body: ReadableStream<Uint8Array>,
  options?: {
    onContentDelta?: (delta: string) => void;
  },
): Promise<AssembledStreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let finishReason: string | null = null;
  const toolCallStore = new Map<number, ToolCallAccumulator>();

  function consumeEventBlock(event: string): void {
    const lines = event.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data:')) {
        continue;
      }
      const data = line.slice('data:'.length).trim();
      if (data === '[DONE]') {
        continue;
      }

      const parsed = parseOpenAiSseData(data);
      if (!parsed) {
        continue;
      }

      if (parsed.contentDelta) {
        content += parsed.contentDelta;
        options?.onContentDelta?.(parsed.contentDelta);
      }
      if (parsed.toolCallDeltas.length > 0) {
        accumulateToolCallDeltas(toolCallStore, parsed.toolCallDeltas);
      }
      if (parsed.finishReason) {
        finishReason = parsed.finishReason;
      }
    }
  }

  function consumeBufferChunk(chunk: string, flushTail: boolean): void {
    buffer += chunk.replace(/\r\n/g, '\n');
    const events = buffer.split('\n\n');
    if (flushTail) {
      buffer = '';
    } else {
      buffer = events.pop() ?? '';
    }
    for (const event of events) {
      if (event.trim().length === 0) {
        continue;
      }
      consumeEventBlock(event);
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      consumeBufferChunk(decoder.decode(), true);
      break;
    }
    consumeBufferChunk(decoder.decode(value, { stream: true }), false);
  }

  return {
    content,
    toolCalls: toolCallsFromAccumulator(toolCallStore),
    finishReason,
  };
}

export function encodeOpenAiContentDelta(content: string): Uint8Array {
  const payload = JSON.stringify({
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  });
  return new TextEncoder().encode(`data: ${payload}\n\n`);
}

export function encodeOpenAiDone(): Uint8Array {
  return new TextEncoder().encode('data: [DONE]\n\n');
}
