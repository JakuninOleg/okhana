import { describe, expect, it } from 'vitest';
import {
  accumulateToolCallDeltas,
  assembleOpenAiSseStream,
  parseOpenAiSseData,
  toolCallsFromAccumulator,
} from '@/features/ai/openai-sse';

describe('parseOpenAiSseData', () => {
  it('returns null for DONE and empty payloads', () => {
    expect(parseOpenAiSseData('[DONE]')).toBeNull();
    expect(parseOpenAiSseData('')).toBeNull();
  });

  it('extracts content deltas', () => {
    expect(
      parseOpenAiSseData(JSON.stringify({
        choices: [{ delta: { content: 'Hi' }, finish_reason: null }],
      })),
    ).toEqual({
      contentDelta: 'Hi',
      toolCallDeltas: [],
      finishReason: null,
    });
  });

  it('extracts partial tool call deltas', () => {
    expect(
      parseOpenAiSseData(JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: 'call_1',
              function: { name: 'search_notes', arguments: '{"q' },
            }],
          },
        }],
      })),
    ).toEqual({
      contentDelta: '',
      toolCallDeltas: [{ index: 0, id: 'call_1', name: 'search_notes', arguments: '{"q' }],
      finishReason: null,
    });
  });

  it('forwards opaque extra_content on tool-call deltas without inspecting it', () => {
    const opaque = { google: { opaque_marker: true } };
    const parsed = parseOpenAiSseData(JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: 'call_1',
            function: { name: 'search_notes', arguments: '{}' },
            extra_content: opaque,
          }],
        },
      }],
    }));

    // Value is opaque and must round-trip structurally; JSON SSE parse yields a new object.
    expect(parsed?.toolCallDeltas[0]?.extra_content).toEqual(opaque);
  });
});

describe('tool call accumulation', () => {
  it('merges fragmented tool-call argument chunks in order', () => {
    const store = new Map();
    accumulateToolCallDeltas(store, [
      { index: 0, id: 'call_1', name: 'search_notes', arguments: '{"query":"' },
      { index: 0, arguments: 'milk"}' },
    ]);

    expect(toolCallsFromAccumulator(store)).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'search_notes', arguments: '{"query":"milk"}' },
      },
    ]);
  });

  it('retains extra_content through merge and final assembly', () => {
    const opaque = { provider: { keep: true } };
    const store = new Map();
    accumulateToolCallDeltas(store, [
      {
        index: 0,
        id: 'call_1',
        name: 'search_notes',
        arguments: '{"query":"',
        extra_content: opaque,
      },
      { index: 0, arguments: 'milk"}' },
    ]);

    expect(toolCallsFromAccumulator(store)).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'search_notes', arguments: '{"query":"milk"}' },
        extra_content: opaque,
      },
    ]);
  });
});

describe('assembleOpenAiSseStream', () => {
  it('assembles streamed content without recursion', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const deltas: string[] = [];
    const result = await assembleOpenAiSseStream(stream, {
      onContentDelta: (delta) => deltas.push(delta),
    });

    expect(result.content).toBe('Hello');
    expect(result.toolCalls).toEqual([]);
    expect(deltas).toEqual(['Hel', 'lo']);
  });

  it('assembles tool calls retaining extra_content from SSE chunks', async () => {
    const opaque = { google: { thought_signature: 'opaque-test-token' } };
    const chunks = [
      `data: ${JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: 'search_notes', arguments: '{"query":"x"}' },
              extra_content: opaque,
            }],
          },
        }],
      })}\n\n`,
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const result = await assembleOpenAiSseStream(stream);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.extra_content).toEqual(opaque);
  });
});
