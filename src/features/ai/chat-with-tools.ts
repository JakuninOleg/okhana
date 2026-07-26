import { goAiChatCompletions, readGoAiSafeError } from '@/features/ai/go-ai-client';
import { buildGoAiFailureDiagnostics } from '@/features/ai/go-ai-failure-diagnostics';
import {
  assembleOpenAiSseStream,
  encodeOpenAiContentDelta,
  encodeOpenAiDone,
} from '@/features/ai/openai-sse';
import type { BuildAiToolsInput } from '@/features/ai/tools';
import { executeAiTool, getAiToolDefinitions } from '@/features/ai/tools';
import type { GoAiMessage } from '@/features/ai/go-ai-types';

/** Hard cap on model→tool→model rounds. Iterative loop (no recursion) avoids stack overflows. */
export const MAX_TOOL_ITERATIONS = 3;

export type ChatWithToolsInput = {
  messages: GoAiMessage[];
  /** When omitted, the model runs without tools (ephemeral / DB-down mode). */
  toolContext?: BuildAiToolsInput;
  signal?: AbortSignal;
  onComplete?: (result: { text: string }) => Promise<void> | void;
  fetchImpl?: typeof fetch;
};

/**
 * Variant A tool loop from Go-Ai docs: app executes tools; Go-Ai only proxies tool_calls.
 * Streams OpenAI-compatible SSE content deltas to the browser through this Response.
 */
export function createChatWithToolsStream(input: ChatWithToolsInput): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let workingMessages = [...input.messages];
      let finalText = '';

      try {
        for (let step = 0; step < MAX_TOOL_ITERATIONS; step += 1) {
          const includeTools = Boolean(input.toolContext) && step < MAX_TOOL_ITERATIONS - 1;
          const upstream = await goAiChatCompletions({
            fetchImpl: input.fetchImpl,
            signal: input.signal,
            body: {
              // Prefer Go-Ai local alias; omit provider slugs.
              model: 'default',
              messages: workingMessages,
              stream: true,
              tools: includeTools ? getAiToolDefinitions() : undefined,
              tool_choice: includeTools ? 'auto' : undefined,
              parallel_tool_calls: includeTools ? true : undefined,
            },
          });

          if (!upstream.ok) {
            const safeError = await readGoAiSafeError(upstream);
            // Diagnostic-only: structural metadata — never content, args, IDs, or bodies.
            console.error('Go-Ai chat failed', buildGoAiFailureDiagnostics({
              response: upstream,
              step,
              messages: workingMessages,
            }));
            controller.enqueue(encodeOpenAiContentDelta(safeError.message));
            finalText = safeError.message;
            break;
          }

          if (!upstream.body) {
            const fallback = 'The model gateway returned an empty response.';
            controller.enqueue(encodeOpenAiContentDelta(fallback));
            finalText = fallback;
            break;
          }

          const assembled = await assembleOpenAiSseStream(upstream.body, {
            onContentDelta: (delta) => {
              controller.enqueue(encodeOpenAiContentDelta(delta));
            },
          });

          if (assembled.toolCalls.length === 0) {
            finalText = assembled.content;
            break;
          }

          workingMessages = [
            ...workingMessages,
            {
              role: 'assistant',
              content: assembled.content.length > 0 ? assembled.content : null,
              tool_calls: assembled.toolCalls,
            },
          ];

          for (const toolCall of assembled.toolCalls) {
            if (!input.toolContext) {
              workingMessages = [
                ...workingMessages,
                {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: 'Tools unavailable while database is down.' }),
                },
              ];
              continue;
            }
            const toolResult = await executeAiTool(
              input.toolContext,
              toolCall.function.name,
              toolCall.function.arguments,
            );
            workingMessages = [
              ...workingMessages,
              {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult),
              },
            ];
          }
        }
      } catch (error) {
        if (input.signal?.aborted) {
          return;
        }
        const message = 'Something went wrong while contacting the assistant.';
        controller.enqueue(encodeOpenAiContentDelta(message));
        finalText = message;
        void error;
      } finally {
        try {
          await input.onComplete?.({ text: finalText });
        } catch {
          // Persistence failures must not break an already-streamed reply.
        }
        controller.enqueue(encodeOpenAiDone());
        controller.close();
      }
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
