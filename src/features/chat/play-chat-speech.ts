import type { Locale } from '@/i18n/routing';
import { isConfidentlyEnglish } from '@/features/ai/english-guard';

export type PlayChatSpeechResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

/**
 * Opt-in TTS playback for the EN UI only.
 * RU locale must not call the speech endpoint.
 */
export async function playChatSpeech(input: {
  text: string;
  locale: Locale;
  signal?: AbortSignal;
}): Promise<PlayChatSpeechResult> {
  if (input.locale !== 'en') {
    return { ok: false, status: 403, error: 'Speech is not available for this locale' };
  }

  const text = input.text.trim();
  if (!text || !isConfidentlyEnglish(text)) {
    return { ok: false, status: 422, error: 'Speech is only available for English responses' };
  }

  if (input.signal?.aborted) {
    return { ok: false, status: 499, error: 'Speech cancelled' };
  }

  try {
    const response = await fetch('/api/chat/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: input.signal,
      body: JSON.stringify({ text, locale: 'en' }),
    });

    if (!response.ok || !response.body) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return {
        ok: false,
        status: response.status,
        error: payload?.error ?? 'Speech request failed',
      };
    }

    const audioBlob = await response.blob();
    const url = URL.createObjectURL(audioBlob);
    try {
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        const onAbort = (): void => {
          audio.pause();
          reject(new DOMException('Speech cancelled', 'AbortError'));
        };
        if (input.signal) {
          if (input.signal.aborted) {
            onAbort();
            return;
          }
          input.signal.addEventListener('abort', onAbort, { once: true });
        }
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio playback failed'));
        void audio.play().catch(reject);
      });
      return { ok: true };
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    if (isAbortError(error) || input.signal?.aborted) {
      return { ok: false, status: 499, error: 'Speech cancelled' };
    }
    return { ok: false, status: 500, error: 'Audio playback failed' };
  }
}
