import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockGetGoAiConfig = vi.hoisted(() => vi.fn());
const mockGoAiAudioSpeech = vi.hoisted(() =>
  vi.fn(async (_options: unknown): Promise<Response> => new Response()),
);
const mockReadGoAiSafeError = vi.hoisted(() =>
  vi.fn(
    async (_response: unknown): Promise<{ status: number; message: string; code: string | null }> => ({
      status: 502,
      message: 'upstream',
      code: null,
    }),
  ),
);

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/features/ai/go-ai-client', () => ({
  getGoAiConfig: () => mockGetGoAiConfig(),
  goAiAudioSpeech: (options: unknown) => mockGoAiAudioSpeech(options),
  readGoAiSafeError: (response: unknown) => mockReadGoAiSafeError(response),
}));

describe('POST /api/chat/speech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockGetGoAiConfig.mockReturnValue({
      baseUrl: 'https://go-ai.example',
      sharedSecret: 'secret',
    });
  });

  it('rejects ru locale without calling Go-Ai', async () => {
    const { POST } = await import('@/app/api/chat/speech/route');
    const response = await POST(
      new Request('http://localhost/api/chat/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: 'ru',
          text: 'You still have milk on the grocery list today.',
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockGoAiAudioSpeech).not.toHaveBeenCalled();
  });

  it('rejects non-English text in en locale', async () => {
    const { POST } = await import('@/app/api/chat/speech/route');
    const response = await POST(
      new Request('http://localhost/api/chat/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: 'en',
          text: 'В списке покупок ещё есть молоко для семьи.',
        }),
      }),
    );

    expect(response.status).toBe(422);
    expect(mockGoAiAudioSpeech).not.toHaveBeenCalled();
  });

  it('streams audio for English text in en locale', async () => {
    mockGoAiAudioSpeech.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'audio/wav' },
      }),
    );

    const { POST } = await import('@/app/api/chat/speech/route');
    const response = await POST(
      new Request('http://localhost/api/chat/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: 'en',
          text: 'You still have milk on the grocery list today.',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/wav');
    expect(mockGoAiAudioSpeech).toHaveBeenCalledOnce();
  });

  it('maps gateway auth failures to 502 for the browser', async () => {
    mockGoAiAudioSpeech.mockResolvedValue(
      Response.json({ error: { message: 'unauthorized', code: 'auth_error' } }, { status: 401 }),
    );
    mockReadGoAiSafeError.mockResolvedValue({
      status: 401,
      message: 'The model gateway rejected authentication. Check GO_AI_SHARED_SECRET.',
      code: 'auth_error',
    });

    const { POST } = await import('@/app/api/chat/speech/route');
    const response = await POST(
      new Request('http://localhost/api/chat/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: 'en',
          text: 'You still have milk on the grocery list today.',
        }),
      }),
    );

    expect(response.status).toBe(502);
    expect(mockGoAiAudioSpeech).toHaveBeenCalledOnce();
  });
});
