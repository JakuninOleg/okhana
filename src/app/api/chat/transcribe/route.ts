import { auth } from '@clerk/nextjs/server';
import { goAiAudioTranscriptions, getGoAiConfig, readGoAiSafeError } from '@/features/ai/go-ai-client';

export const runtime = 'nodejs';

const STT_MODEL = 'whisper-large-v3-turbo';

/**
 * Browser → Okhana → Go-Ai STT. Never expose the gateway secret to the client.
 * Rebuilds multipart with a known Content-Length (required by Go-Ai).
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

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return Response.json({ error: 'Expected multipart audio upload' }, { status: 415 });
  }

  const incoming = await request.formData();
  const file = incoming.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: 'Audio file is required' }, { status: 400 });
  }

  const language = incoming.get('language');
  const outbound = new FormData();
  outbound.append('file', file, file.name || 'recording.webm');
  outbound.append('model', STT_MODEL);
  if (typeof language === 'string' && language.length > 0) {
    outbound.append('language', language);
  }

  const encoded = new Request('http://localhost/transcribe', {
    method: 'POST',
    body: outbound,
  });
  const outboundType = encoded.headers.get('content-type');
  if (!outboundType) {
    return Response.json({ error: 'Failed to encode audio upload' }, { status: 500 });
  }
  const bodyBuffer = Buffer.from(await encoded.arrayBuffer());

  const upstream = await goAiAudioTranscriptions({
    body: bodyBuffer,
    contentType: outboundType,
    contentLength: String(bodyBuffer.byteLength),
    signal: request.signal,
  });

  if (!upstream.ok) {
    const safe = await readGoAiSafeError(upstream);
    return Response.json({ error: safe.message }, { status: safe.status });
  }

  const payload = (await upstream.json()) as { text?: unknown };
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    return Response.json({ error: 'Transcription returned no text' }, { status: 502 });
  }

  return Response.json({ text });
}
