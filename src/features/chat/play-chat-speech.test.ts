import { afterEach, describe, expect, it, vi } from 'vitest';
import { playChatSpeech } from '@/features/chat/play-chat-speech';

describe('playChatSpeech', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not call the speech API for ru locale', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await playChatSpeech({
      locale: 'ru',
      text: 'You still have milk on the grocery list today.',
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: 'Speech is not available for this locale',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the speech API for non-English text in en locale', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await playChatSpeech({
      locale: 'en',
      text: 'В списке покупок ещё есть молоко для семьи.',
    });

    expect(result).toEqual({
      ok: false,
      status: 422,
      error: 'Speech is only available for English responses',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts EN speech requests and plays returned audio', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'audio/wav' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:okhana-test'),
      revokeObjectURL: vi.fn(),
    });

    class FakeAudio {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = vi.fn(async () => {
        queueMicrotask(() => this.onended?.());
      });
    }
    vi.stubGlobal('Audio', FakeAudio);

    const result = await playChatSpeech({
      locale: 'en',
      text: 'You still have milk on the grocery list today.',
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      text: 'You still have milk on the grocery list today.',
      locale: 'en',
    });
  });

  it('returns the safe API error when speech fails', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { error: 'Groq requires accepting Orpheus TTS model terms in the console before speech works.' },
        { status: 400 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await playChatSpeech({
      locale: 'en',
      text: 'You still have milk on the grocery list today.',
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Groq requires accepting Orpheus TTS model terms in the console before speech works.',
    });
  });
});
