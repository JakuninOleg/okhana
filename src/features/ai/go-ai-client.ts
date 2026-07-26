import type { GoAiChatCompletionRequest } from '@/features/ai/go-ai-types';

export type GoAiClientConfig = {
  baseUrl: string;
  sharedSecret: string;
};

export function getGoAiConfig(): GoAiClientConfig {
  const baseUrl = process.env.GO_AI_BASE_URL?.replace(/\/$/, '');
  const sharedSecret = process.env.GO_AI_SHARED_SECRET;

  if (!baseUrl) {
    throw new Error('GO_AI_BASE_URL is not configured');
  }
  if (!sharedSecret) {
    throw new Error('GO_AI_SHARED_SECRET is not configured');
  }

  return { baseUrl, sharedSecret };
}

export type GoAiChatCompletionsOptions = {
  body: GoAiChatCompletionRequest;
  signal?: AbortSignal;
  /** Optional override for tests. */
  config?: GoAiClientConfig;
  fetchImpl?: typeof fetch;
};

/**
 * Server-only OpenAI-compatible call to Go-Ai.
 * Never import this module from client components.
 */
export async function goAiChatCompletions(options: GoAiChatCompletionsOptions): Promise<Response> {
  const config = options.config ?? getGoAiConfig();
  const fetchImpl = options.fetchImpl ?? fetch;

  return fetchImpl(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.sharedSecret}`,
    },
    body: JSON.stringify(options.body),
    signal: options.signal,
  });
}

export type GoAiSafeError = {
  status: number;
  /** Safe, user-facing summary — never includes prompts, secrets, or raw bodies. */
  message: string;
  code: string | null;
};

/**
 * Extract a safe error summary from a failed Go-Ai response.
 * Does not return request/response bodies, tokens, or tool arguments.
 */
export async function readGoAiSafeError(response: Response): Promise<GoAiSafeError> {
  const fallback: GoAiSafeError = {
    status: response.status,
    message: `Model gateway error (${response.status})`,
    code: null,
  };

  try {
    const payload = (await response.clone().json()) as {
      error?: { message?: unknown; code?: unknown; type?: unknown };
    };
    const code = typeof payload.error?.code === 'string' ? payload.error.code : null;
    const type = typeof payload.error?.type === 'string' ? payload.error.type : null;
    const upstreamMessage =
      typeof payload.error?.message === 'string' ? payload.error.message.trim() : '';

    // Only forward short, non-sensitive gateway codes/messages we already know are safe.
    if (code === 'provider_error' || type === 'server_error') {
      return {
        status: response.status,
        code,
        message: 'The model gateway could not reach its upstream AI provider. Try again later.',
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: response.status,
        code,
        message: 'The model gateway rejected authentication. Check GO_AI_SHARED_SECRET.',
      };
    }
    if (upstreamMessage && upstreamMessage.length <= 120 && !/[{\n]/.test(upstreamMessage)) {
      return {
        status: response.status,
        code,
        message: upstreamMessage,
      };
    }
  } catch {
    // Non-JSON error bodies are common for some gateway failures.
  }

  return fallback;
}
