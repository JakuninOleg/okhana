import { describe, expect, it, vi } from 'vitest';
import { getGoAiConfig, goAiChatCompletions, readGoAiSafeError } from '@/features/ai/go-ai-client';

describe('getGoAiConfig', () => {
  it('throws when GO_AI_BASE_URL is missing', () => {
    const previousBase = process.env.GO_AI_BASE_URL;
    const previousSecret = process.env.GO_AI_SHARED_SECRET;
    delete process.env.GO_AI_BASE_URL;
    process.env.GO_AI_SHARED_SECRET = 'secret';

    expect(() => getGoAiConfig()).toThrow(/GO_AI_BASE_URL/);

    process.env.GO_AI_BASE_URL = previousBase;
    process.env.GO_AI_SHARED_SECRET = previousSecret;
  });

  it('throws when GO_AI_SHARED_SECRET is missing', () => {
    const previousBase = process.env.GO_AI_BASE_URL;
    const previousSecret = process.env.GO_AI_SHARED_SECRET;
    process.env.GO_AI_BASE_URL = 'https://go-ai.example';
    delete process.env.GO_AI_SHARED_SECRET;

    expect(() => getGoAiConfig()).toThrow(/GO_AI_SHARED_SECRET/);

    process.env.GO_AI_BASE_URL = previousBase;
    process.env.GO_AI_SHARED_SECRET = previousSecret;
  });

  it('strips trailing slash from the base URL', () => {
    const previousBase = process.env.GO_AI_BASE_URL;
    const previousSecret = process.env.GO_AI_SHARED_SECRET;
    process.env.GO_AI_BASE_URL = 'https://go-ai.example/';
    process.env.GO_AI_SHARED_SECRET = 'secret';

    expect(getGoAiConfig()).toEqual({
      baseUrl: 'https://go-ai.example',
      sharedSecret: 'secret',
    });

    process.env.GO_AI_BASE_URL = previousBase;
    process.env.GO_AI_SHARED_SECRET = previousSecret;
  });
});

describe('goAiChatCompletions', () => {
  it('posts OpenAI-compatible JSON with bearer auth to Go-Ai', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));

    await goAiChatCompletions({
      config: {
        baseUrl: 'https://go-ai.example',
        sharedSecret: 'test-secret',
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      body: {
        model: 'default',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      },
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://go-ai.example/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-secret',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'default',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    });
  });
});

describe('readGoAiSafeError', () => {
  it('maps provider_error to a clear user-facing message', async () => {
    const response = new Response(
      JSON.stringify({
        error: { message: 'AI provider error', type: 'server_error', code: 'provider_error' },
      }),
      { status: 502 },
    );

    await expect(readGoAiSafeError(response)).resolves.toEqual({
      status: 502,
      code: 'provider_error',
      message: 'The model gateway could not reach its upstream AI provider. Try again later.',
    });
  });

  it('maps auth failures without leaking secrets', async () => {
    const response = new Response(
      JSON.stringify({ error: { message: 'unauthorized', code: 'auth_error' } }),
      { status: 401 },
    );

    await expect(readGoAiSafeError(response)).resolves.toMatchObject({
      status: 401,
      message: 'The model gateway rejected authentication. Check GO_AI_SHARED_SECRET.',
    });
  });

  it('maps model_terms_required without leaking upstream detail', async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          message: 'The model canopylabs/orpheus-v1-english requires terms acceptance.',
          type: 'invalid_request_error',
          code: 'model_terms_required',
        },
      }),
      { status: 400 },
    );

    await expect(readGoAiSafeError(response)).resolves.toEqual({
      status: 400,
      code: 'model_terms_required',
      message:
        'Groq requires accepting Orpheus TTS model terms in the console before speech works.',
    });
  });
});
