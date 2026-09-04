import type { FamilyChatMessage } from '@/features/chat/family-chat-storage';
import {
  readStoredFamilyChat,
  writeStoredFamilyChat,
} from '@/features/chat/family-chat-storage';

const CHANGE_EVENT = 'okhana-family-chat';

export type FamilyChatSnapshot = {
  messages: FamilyChatMessage[];
  input: string;
};

/** Stable empty snapshot for SSR / hydration (must be referentially equal across calls). */
const SERVER_SNAPSHOT: FamilyChatSnapshot = Object.freeze({
  messages: [] as FamilyChatMessage[],
  input: '',
});

let cachedSnapshot: FamilyChatSnapshot | null = null;

function readCachedSnapshot(): FamilyChatSnapshot {
  if (cachedSnapshot) {
    return cachedSnapshot;
  }
  cachedSnapshot = readStoredFamilyChat();
  return cachedSnapshot;
}

function commitSnapshot(snapshot: FamilyChatSnapshot): void {
  cachedSnapshot = snapshot;
  writeStoredFamilyChat(snapshot);
  emitChange();
}

function emitChange(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeFamilyChat(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(CHANGE_EVENT, onStoreChange);
}

export function getFamilyChatSnapshot(): FamilyChatSnapshot {
  return readCachedSnapshot();
}

export function getServerFamilyChatSnapshot(): FamilyChatSnapshot {
  return SERVER_SNAPSHOT;
}

export function replaceFamilyChatSnapshot(snapshot: FamilyChatSnapshot): void {
  commitSnapshot(snapshot);
}

export function updateFamilyChatMessages(
  updater: (current: FamilyChatMessage[]) => FamilyChatMessage[],
): void {
  const current = readCachedSnapshot();
  commitSnapshot({
    messages: updater(current.messages),
    input: current.input,
  });
}

export function updateFamilyChatInput(input: string): void {
  const current = readCachedSnapshot();
  if (current.input === input) {
    return;
  }
  commitSnapshot({
    messages: current.messages,
    input,
  });
}

const SEND_EVENT = 'okhana-family-chat-send';
let pendingSendText: string | null = null;

/** Ask the open FamilyChat to submit text (used by task sheet / quick actions). */
export function requestFamilyChatSend(text: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  pendingSendText = trimmed;
  window.dispatchEvent(new Event(SEND_EVENT));
}

/**
 * Subscriber should return true when the text was accepted for send.
 * Returning false keeps the text queued (e.g. chat still streaming / not ready).
 */
export function subscribeFamilyChatSend(
  onSend: (text: string) => boolean,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const flush = (): void => {
    const text = pendingSendText;
    if (!text) {
      return;
    }
    if (onSend(text)) {
      pendingSendText = null;
    }
  };
  window.addEventListener(SEND_EVENT, flush);
  // Drain anything queued before FamilyChat mounted (dynamic import).
  flush();
  return () => window.removeEventListener(SEND_EVENT, flush);
}

/** Re-attempt a queued send after the chat becomes idle. */
export function flushFamilyChatSend(): void {
  if (typeof window === 'undefined' || !pendingSendText) {
    return;
  }
  window.dispatchEvent(new Event(SEND_EVENT));
}
