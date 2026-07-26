export type FamilyChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const SESSION_MESSAGES_KEY = 'okhana.familyChat.messages.v1';
const LOCAL_DRAFT_KEY = 'okhana.familyChat.draft.v1';
/** Legacy key — messages+draft were bundled in sessionStorage before draft moved to localStorage. */
const LEGACY_SESSION_KEY = 'okhana.familyChat.v1';

type StoredMessages = {
  messages: FamilyChatMessage[];
};

type LegacyStoredFamilyChat = {
  messages?: FamilyChatMessage[];
  input?: string;
};

function isChatMessage(value: unknown): value is FamilyChatMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as Partial<FamilyChatMessage>;
  return (
    typeof message.id === 'string'
    && (message.role === 'user' || message.role === 'assistant' || message.role === 'system')
    && typeof message.content === 'string'
  );
}

function readLegacySession(): { messages: FamilyChatMessage[]; input: string } | null {
  try {
    const raw = window.sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LegacyStoredFamilyChat;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages.filter(isChatMessage) : [],
      input: typeof parsed.input === 'string' ? parsed.input : '',
    };
  } catch {
    return null;
  }
}

function readDraftFromLocalStorage(): string {
  try {
    const raw = window.localStorage.getItem(LOCAL_DRAFT_KEY);
    if (raw === null) {
      return '';
    }
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'string' ? parsed : '';
  } catch {
    return '';
  }
}

function writeDraftToLocalStorage(input: string): void {
  try {
    if (input.length === 0) {
      window.localStorage.removeItem(LOCAL_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(input));
  } catch {
    // Private mode / quota — chat still works without draft persistence.
  }
}

function readMessagesFromSession(): FamilyChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_MESSAGES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StoredMessages;
    return Array.isArray(parsed.messages) ? parsed.messages.filter(isChatMessage) : [];
  } catch {
    return [];
  }
}

function writeMessagesToSession(messages: FamilyChatMessage[]): void {
  try {
    if (messages.length === 0) {
      window.sessionStorage.removeItem(SESSION_MESSAGES_KEY);
      return;
    }
    window.sessionStorage.setItem(SESSION_MESSAGES_KEY, JSON.stringify({ messages } satisfies StoredMessages));
  } catch {
    // Private mode / quota — chat still works without session persistence.
  }
}

/**
 * Messages: sessionStorage (locale remounts, same tab).
 * Draft: localStorage (survives refresh and tab reopen).
 */
export function readStoredFamilyChat(): { messages: FamilyChatMessage[]; input: string } {
  if (typeof window === 'undefined') {
    return { messages: [], input: '' };
  }

  let messages = readMessagesFromSession();
  let input = readDraftFromLocalStorage();

  // One-time migration from the previous single sessionStorage blob.
  const legacy = readLegacySession();
  if (legacy) {
    if (messages.length === 0 && legacy.messages.length > 0) {
      messages = legacy.messages;
      writeMessagesToSession(messages);
    }
    if (input.length === 0 && legacy.input.length > 0) {
      input = legacy.input;
      writeDraftToLocalStorage(input);
    }
    try {
      window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // ignore
    }
  }

  return { messages, input };
}

export function writeStoredFamilyChat(input: {
  messages: FamilyChatMessage[];
  input: string;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  writeMessagesToSession(input.messages);
  writeDraftToLocalStorage(input.input);
}
