import type { Locale } from '@/i18n/routing';
import { isConfidentlyEnglish } from '@/features/ai/english-guard';

export type PlayChatSpeechResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

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
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
      void audio.play().catch(reject);
    });
    return { ok: true };
  } catch {
    return { ok: false, status: 500, error: 'Audio playback failed' };
  } finally {
    URL.revokeObjectURL(url);
  }
}
