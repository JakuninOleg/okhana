export type GoAiRole = 'system' | 'user' | 'assistant' | 'tool';

export type GoAiToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  /** Opaque Gemini/OpenAI-compat metadata — must round-trip unchanged. */
  extra_content?: unknown;
};

export type GoAiMessage = {
  role: GoAiRole;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: GoAiToolCall[];
};

export type GoAiToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type GoAiChatCompletionRequest = {
  model?: string;
  messages: GoAiMessage[];
  stream?: boolean;
  temperature?: number;
  tools?: GoAiToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  parallel_tool_calls?: boolean;
};

export type GoAiChatCompletionChoice = {
  index?: number;
  finish_reason?: string | null;
  message?: GoAiMessage;
  delta?: {
    role?: string;
    content?: string | null;
    tool_calls?: Array<{
      index?: number;
      id?: string;
      type?: 'function';
      function?: {
        name?: string;
        arguments?: string;
      };
      extra_content?: unknown;
    }>;
  };
};

export type GoAiChatCompletionResponse = {
  id?: string;
  choices?: GoAiChatCompletionChoice[];
};
