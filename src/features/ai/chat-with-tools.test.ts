import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MAX_TOOL_ITERATIONS, createChatWithToolsStream } from '@/features/ai/chat-with-tools';

const mockExecuteAiTool = vi.hoisted(() => vi.fn());

vi.mock('@/features/ai/tools', () => ({
  getAiToolDefinitions: () => [
    {
      type: 'function',
      function: {
        name: 'search_notes',
        description: 'Search notes',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    },
  ],
  executeAiTool: (...args: unknown[]) => mockExecuteAiTool(...args),
}));

function sseResponse(chunks: string[]): Response {
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

async function readStreamText(response: Response): Promise<string> {
  const text = await response.text();
  const pieces: string[] = [];
  for (const event of text.split('\n\n')) {
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) pieces.push(delta);
    }
  }
  return pieces.join('');
}

describe('createChatWithToolsStream', () => {
  beforeEach(() => {
    mockExecuteAiTool.mockReset();
    process.env.GO_AI_BASE_URL = 'https://go-ai.example';
    process.env.GO_AI_SHARED_SECRET = 'test-secret';
  });

  it('exposes a finite tool iteration budget', () => {
    expect(MAX_TOOL_ITERATIONS).toBe(3);
  });

  it('streams a plain assistant reply when no tools are requested', async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Saved"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    );

    const onComplete = vi.fn();
    const response = createChatWithToolsStream({
      messages: [{ role: 'user', content: 'Hi' }],
      toolContext: { familyId: 1, userId: 2, familyRole: 'owner' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onComplete,
    });

    await expect(readStreamText(response)).resolves.toBe('Saved');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(mockExecuteAiTool).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith({ text: 'Saved' });
  });

  it('executes tool calls iteratively then streams the follow-up answer', async () => {
    mockExecuteAiTool.mockResolvedValue({ notes: [{ title: 'Milk' }] });
    const opaque = { google: { keep: true } };

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          `data: ${JSON.stringify({
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  id: 'call_1',
                  function: { name: 'search_notes', arguments: '{"query":"milk"}' },
                  extra_content: opaque,
                }],
              },
            }],
          })}\n\n`,
          'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"You need milk"}}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = createChatWithToolsStream({
      messages: [{ role: 'user', content: 'What did we save about milk?' }],
      toolContext: { familyId: 1, userId: 2, familyRole: 'adult' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(readStreamText(response)).resolves.toBe('You need milk');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(mockExecuteAiTool).toHaveBeenCalledWith(
      { familyId: 1, userId: 2, familyRole: 'adult' },
      'search_notes',
      '{"query":"milk"}',
    );

    const secondBody = JSON.parse(String((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body));
    expect(secondBody.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'assistant',
        tool_calls: [
          expect.objectContaining({
            id: 'call_1',
            extra_content: opaque,
          }),
        ],
      }),
      expect.objectContaining({ role: 'tool', tool_call_id: 'call_1' }),
    ]));

    for (const call of errorSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('opaque');
      expect(JSON.stringify(call)).not.toContain('thought');
    }
    errorSpy.mockRestore();
  });

  it('stops after MAX_TOOL_ITERATIONS and does not recurse', async () => {
    mockExecuteAiTool.mockResolvedValue({ notes: [] });

    const toolOnly = () =>
      sseResponse([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_x","function":{"name":"search_notes","arguments":"{\\"query\\":\\"x\\"}"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ]);

    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(toolOnly)
      .mockImplementationOnce(toolOnly)
      .mockImplementationOnce(async () =>
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Giving up tools"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      );

    const response = createChatWithToolsStream({
      messages: [{ role: 'user', content: 'loop' }],
      toolContext: { familyId: 1, userId: 2, familyRole: 'owner' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(readStreamText(response)).resolves.toBe('Giving up tools');
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_TOOL_ITERATIONS);
    expect(mockExecuteAiTool).toHaveBeenCalledTimes(2);

    const lastBody = JSON.parse(String((fetchImpl.mock.calls[2] as [string, RequestInit])[1].body));
    expect(lastBody.tools).toBeUndefined();
  });
});
