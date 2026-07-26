import type { GoAiMessage } from '@/features/ai/go-ai-types';

/** Safe, non-sensitive metadata for Go-Ai / Gemini tool-loop failures. */
export type GoAiFailureDiagnostics = {
  status: number;
  step: number;
  goAiProvider: string | null;
  goAiUpstreamModel: string | null;
  goAiFallbackUsed: string | null;
  hasAssistantToolCalls: boolean;
  hasToolRoleMessages: boolean;
  toolCallsCount: number;
  toolRoleMessagesCount: number;
  /** Every role:"tool" tool_call_id appears on a preceding assistant tool_calls entry. */
  toolCallIdsMatched: boolean;
};

/**
 * Structural inspection of outbound messages only — no content, names, args, or IDs emitted.
 */
export function inspectOutboundToolMessageStructure(messages: GoAiMessage[]): {
  hasAssistantToolCalls: boolean;
  hasToolRoleMessages: boolean;
  toolCallsCount: number;
  toolRoleMessagesCount: number;
  toolCallIdsMatched: boolean;
} {
  let toolCallsCount = 0;
  let toolRoleMessagesCount = 0;
  let hasAssistantToolCalls = false;
  let hasToolRoleMessages = false;
  let toolCallIdsMatched = true;
  const seenAssistantCallIds = new Set<string>();

  for (const message of messages) {
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      hasAssistantToolCalls = true;
      toolCallsCount += message.tool_calls.length;
      for (const call of message.tool_calls) {
        if (call.id) {
          seenAssistantCallIds.add(call.id);
        }
      }
    }

    if (message.role === 'tool') {
      hasToolRoleMessages = true;
      toolRoleMessagesCount += 1;
      const callId = message.tool_call_id;
      if (!callId || !seenAssistantCallIds.has(callId)) {
        toolCallIdsMatched = false;
      }
    }
  }

  return {
    hasAssistantToolCalls,
    hasToolRoleMessages,
    toolCallsCount,
    toolRoleMessagesCount,
    toolCallIdsMatched,
  };
}

export function buildGoAiFailureDiagnostics(input: {
  response: Response;
  step: number;
  messages: GoAiMessage[];
}): GoAiFailureDiagnostics {
  const structure = inspectOutboundToolMessageStructure(input.messages);
  return {
    status: input.response.status,
    step: input.step,
    goAiProvider: input.response.headers.get('X-Go-Ai-Provider'),
    goAiUpstreamModel: input.response.headers.get('X-Go-Ai-Upstream-Model'),
    goAiFallbackUsed: input.response.headers.get('X-Go-Ai-Fallback-Used'),
    ...structure,
  };
}
