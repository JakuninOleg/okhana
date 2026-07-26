import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { isConfidentlyEnglish, truncateForTts } from '@/features/ai/english-guard';
import { goAiAudioSpeech, getGoAiConfig, readGoAiSafeError } from '@/features/ai/go-ai-client';
import { routing } from '@/i18n/routing';

export const runtime = 'nodejs';

const TTS_MODEL = 'canopylabs/orpheus-v1-english';
const TTS_VOICE = 'austin';
const TTS_FORMAT = 'wav';

const speechRequestSchema = z.object({
  text: z.string().min(1).max(4_000),
  locale: z.enum(routing.locales),
});

function clientStatusFromUpstream(status: number): number {
  return status === 401 || status === 403 ? 502 : status;
}

/**
 * Browser → Okhana → Go-Ai TTS. Explicit opt-in only — never auto-speak unless
 * the EN UI toggle is on. Hard RU policy: no TTS for `ru` UI (no Russian model).
 */
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    getGoAiConfig();
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: 'Invalid speech payload' }, { status: 400 });
  }

  const parsed = speechRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid speech payload' }, { status: 400 });
  }

  const { text, locale } = parsed.data;
  if (locale === 'ru') {
    return Response.json({ error: 'Speech is not available for this locale' }, { status: 403 });
  }

  if (!isConfidentlyEnglish(text)) {
    return Response.json(
      { error: 'Speech is only available for English responses' },
      { status: 422 },
    );
  }

  const input = truncateForTts(text);
  const upstream = await goAiAudioSpeech({
    body: {
      model: TTS_MODEL,
      input,
      voice: TTS_VOICE,
      response_format: TTS_FORMAT,
    },
    signal: request.signal,
  });

  if (!upstream.ok) {
    const safe = await readGoAiSafeError(upstream);
    return Response.json(
      { error: safe.message },
      { status: clientStatusFromUpstream(safe.status) },
    );
  }

  if (!upstream.body) {
    return Response.json({ error: 'Speech stream unavailable' }, { status: 502 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type') ?? 'audio/wav';
  headers.set('Content-Type', contentType);
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) {
    headers.set('Content-Length', contentLength);
  }
  headers.set('Cache-Control', 'no-store');

  return new Response(upstream.body, { status: 200, headers });
}
