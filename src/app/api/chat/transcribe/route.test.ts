import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockGetGoAiConfig = vi.hoisted(() => vi.fn());
const mockGoAiAudioTranscriptions = vi.hoisted(() =>
  vi.fn(async (_options: unknown): Promise<Response> => new Response()),
);
const mockReadGoAiSafeError = vi.hoisted(() =>
  vi.fn(async (_response: unknown) => ({ status: 502, message: 'upstream', code: null })),
);

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

vi.mock('@/features/ai/go-ai-client', () => ({
  getGoAiConfig: () => mockGetGoAiConfig(),
  goAiAudioTranscriptions: (options: unknown) => mockGoAiAudioTranscriptions(options),
  readGoAiSafeError: (response: unknown) => mockReadGoAiSafeError(response),
}));

describe('POST /api/chat/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'clerk_1' });
    mockGetGoAiConfig.mockReturnValue({
      baseUrl: 'https://go-ai.example',
      sharedSecret: 'secret',
    });
  });

  it('rejects unauthenticated requests', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { POST } = await import('@/app/api/chat/transcribe/route');
    const response = await POST(new Request('http://localhost/api/chat/transcribe', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(mockGoAiAudioTranscriptions).not.toHaveBeenCalled();
  });

  it('rejects non-multipart bodies', async () => {
    const { POST } = await import('@/app/api/chat/transcribe/route');
    const response = await POST(
      new Request('http://localhost/api/chat/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(415);
    expect(mockGoAiAudioTranscriptions).not.toHaveBeenCalled();
  });

  it('rejects multipart uploads without an audio file', async () => {
    const { POST } = await import('@/app/api/chat/transcribe/route');
    const form = new FormData();
    form.append('language', 'en');
    const response = await POST(
      new Request('http://localhost/api/chat/transcribe', {
        method: 'POST',
        body: form,
      }),
    );
    expect(response.status).toBe(400);
    expect(mockGoAiAudioTranscriptions).not.toHaveBeenCalled();
  });

  it('forwards audio to Go-Ai and returns transcribed text', async () => {
    mockGoAiAudioTranscriptions.mockResolvedValue(
      Response.json({ text: ' buy milk ' }, { status: 200 }),
    );

    const { POST } = await import('@/app/api/chat/transcribe/route');
    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'recording.webm', { type: 'audio/webm' }));
    form.append('language', 'en');

    const response = await POST(
      new Request('http://localhost/api/chat/transcribe', {
        method: 'POST',
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: 'buy milk' });
    expect(mockGoAiAudioTranscriptions).toHaveBeenCalledOnce();
    const call = (
      mockGoAiAudioTranscriptions.mock.calls as unknown as Array<
        [{ contentType: string; contentLength: string; body: Buffer }]
      >
    )[0]?.[0];
    expect(call.contentType).toMatch(/multipart\/form-data/i);
    expect(Number(call.contentLength)).toBe(call.body.byteLength);
  });
});
