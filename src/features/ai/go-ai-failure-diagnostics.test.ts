import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGoAiFailureDiagnostics,
  inspectOutboundToolMessageStructure,
} from '@/features/ai/go-ai-failure-diagnostics';
import type { GoAiMessage } from '@/features/ai/go-ai-types';
import { createChatWithToolsStream } from '@/features/ai/chat-with-tools';
import { goAiChatCompletions } from '@/features/ai/go-ai-client';

vi.mock('@/features/ai/tools', () => ({
  getAiToolDefinitions: () => [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Synthetic diagnostic tool',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      },
    },
  ],
  executeAiTool: vi.fn(async () => ({ ok: true, temp_c: 20 })),
}));

function sseToolCallResponse(): Response {
  const chunks = [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_diag_1","function":{"name":"get_weather","arguments":"{\\"location\\":\\"Paris\\"}"}}]}}]}\n\n',
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
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('inspectOutboundToolMessageStructure', () => {
  it('reports matched tool results after a preceding assistant tool_calls message', () => {
    const messages: GoAiMessage[] = [
      { role: 'user', content: 'x' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_a',
          type: 'function',
          function: { name: 'get_weather', arguments: '{}' },
        }],
      },
      { role: 'tool', tool_call_id: 'call_a', content: '{}' },
    ];

    expect(inspectOutboundToolMessageStructure(messages)).toEqual({
      hasAssistantToolCalls: true,
      hasToolRoleMessages: true,
      toolCallsCount: 1,
      toolRoleMessagesCount: 1,
      toolCallIdsMatched: true,
    });
  });

  it('flags unmatched tool-role ids without emitting the ids', () => {
    const messages: GoAiMessage[] = [
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_a',
          type: 'function',
          function: { name: 'get_weather', arguments: '{}' },
        }],
      },
      { role: 'tool', tool_call_id: 'call_other', content: '{}' },
    ];

    expect(inspectOutboundToolMessageStructure(messages).toolCallIdsMatched).toBe(false);
  });
});

describe('buildGoAiFailureDiagnostics', () => {
  it('captures only safe status, step, headers, and message structure', () => {
    const response = new Response(null, {
      status: 400,
      headers: {
        'X-Go-Ai-Provider': 'gemini',
        'X-Go-Ai-Upstream-Model': 'alias-resolved',
        'X-Go-Ai-Fallback-Used': 'false',
      },
    });

    const diagnostics = buildGoAiFailureDiagnostics({
      response,
      step: 1,
      messages: [
        { role: 'user', content: 'secret-should-not-appear' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_a',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"location":"secret"}' },
          }],
        },
        { role: 'tool', tool_call_id: 'call_a', content: '{"temp":1}' },
      ],
    });

    expect(diagnostics).toEqual({
      status: 400,
      step: 1,
      goAiProvider: 'gemini',
      goAiUpstreamModel: 'alias-resolved',
      goAiFallbackUsed: 'false',
      hasAssistantToolCalls: true,
      hasToolRoleMessages: true,
      toolCallsCount: 1,
      toolRoleMessagesCount: 1,
      toolCallIdsMatched: true,
    });
    expect(JSON.stringify(diagnostics)).not.toContain('secret');
    expect(JSON.stringify(diagnostics)).not.toContain('call_a');
    expect(JSON.stringify(diagnostics)).not.toContain('get_weather');
  });
});

describe('synthetic two-turn tool loop diagnostics', () => {
  const previousBaseUrl = process.env.GO_AI_BASE_URL;
  const previousSecret = process.env.GO_AI_SHARED_SECRET;

  beforeEach(() => {
    process.env.GO_AI_BASE_URL = 'https://go-ai.example';
    process.env.GO_AI_SHARED_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (previousBaseUrl === undefined) {
      delete process.env.GO_AI_BASE_URL;
    } else {
      process.env.GO_AI_BASE_URL = previousBaseUrl;
    }
    if (previousSecret === undefined) {
      delete process.env.GO_AI_SHARED_SECRET;
    } else {
      process.env.GO_AI_SHARED_SECRET = previousSecret;
    }
  });

  it('on turn-2 failure logs safe structural metadata including tool history flags', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(sseToolCallResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'provider_error' } }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Go-Ai-Provider': 'gemini',
          'X-Go-Ai-Upstream-Model': 'alias-resolved',
          'X-Go-Ai-Fallback-Used': 'false',
        },
      }));

    const response = createChatWithToolsStream({
      messages: [{ role: 'user', content: 'weather?' }],
      toolContext: { familyId: 1, userId: 2, familyRole: 'owner' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await response.text();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      'Go-Ai chat failed',
      expect.objectContaining({
        status: 400,
        step: 1,
        goAiProvider: 'gemini',
        goAiUpstreamModel: 'alias-resolved',
        goAiFallbackUsed: 'false',
        hasAssistantToolCalls: true,
        hasToolRoleMessages: true,
        toolCallsCount: 1,
        toolRoleMessagesCount: 1,
        toolCallIdsMatched: true,
      }),
    );

    const logged = errorSpy.mock.calls.find((call) => call[0] === 'Go-Ai chat failed')?.[1];
    expect(JSON.stringify(logged)).not.toContain('Paris');
    expect(JSON.stringify(logged)).not.toContain('call_diag');

    errorSpy.mockRestore();
  });
});

describe('live Go-Ai two-turn synthetic tool loop', () => {
  const enabled = process.env.RUN_GO_AI_TOOL_LOOP_DIAG === '1'
    && Boolean(process.env.GO_AI_BASE_URL)
    && Boolean(process.env.GO_AI_SHARED_SECRET);

  it.skipIf(!enabled)('records safe metadata for turn1 and turn2 through Go-Ai', async () => {
    const weatherTool = {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Synthetic diagnostic tool only',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      },
    };

    const turn1 = await goAiChatCompletions({
      body: {
        model: 'default',
        stream: true,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        tools: [weatherTool],
        messages: [{ role: 'user', content: 'Call get_weather for Paris.' }],
      },
    });

    // eslint-disable-next-line no-console
    console.info('Go-Ai tool-loop diag turn1', {
      status: turn1.status,
      goAiProvider: turn1.headers.get('X-Go-Ai-Provider'),
      goAiUpstreamModel: turn1.headers.get('X-Go-Ai-Upstream-Model'),
      goAiFallbackUsed: turn1.headers.get('X-Go-Ai-Fallback-Used'),
    });

    expect(turn1.status).toBe(200);
    if (!turn1.ok || !turn1.body) {
      return;
    }

    const { assembleOpenAiSseStream } = await import('@/features/ai/openai-sse');
    const assembled = await assembleOpenAiSseStream(turn1.body);
    if (assembled.toolCalls.length === 0) {
      // eslint-disable-next-line no-console
      console.info('Go-Ai tool-loop diag turn1', { toolCallsCount: 0 });
      return;
    }

    const extraContentPresentOnTurn2 = assembled.toolCalls.every(
      (call) => call.extra_content !== undefined,
    )
      ? 'yes'
      : 'no';

    const followUpMessages: GoAiMessage[] = [
      { role: 'user', content: 'Call get_weather for Paris.' },
      {
        role: 'assistant',
        content: assembled.content.length > 0 ? assembled.content : null,
        tool_calls: assembled.toolCalls,
      },
      ...assembled.toolCalls.map((call) => ({
        role: 'tool' as const,
        tool_call_id: call.id,
        content: JSON.stringify({ ok: true, temp_c: 18 }),
      })),
    ];

    const turn2 = await goAiChatCompletions({
      body: {
        model: 'default',
        stream: true,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        tools: [weatherTool],
        messages: followUpMessages,
      },
    });

    // eslint-disable-next-line no-console
    console.info('Go-Ai tool-loop diag turn2', {
      status: turn2.status,
      goAiProvider: turn2.headers.get('X-Go-Ai-Provider'),
      goAiUpstreamModel: turn2.headers.get('X-Go-Ai-Upstream-Model'),
      goAiFallbackUsed: turn2.headers.get('X-Go-Ai-Fallback-Used'),
      extraContentPresentOnTurn2,
    });

    expect(turn2.status).toBe(200);
    expect(extraContentPresentOnTurn2).toBe('yes');
  }, 60_000);
});
