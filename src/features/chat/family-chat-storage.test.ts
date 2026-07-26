import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  readStoredFamilyChat,
  writeStoredFamilyChat,
} from '@/features/chat/family-chat-storage';

describe('family-chat-storage', () => {
  const sessionMemory = new Map<string, string>();
  const localMemory = new Map<string, string>();

  function createStorage(memory: Map<string, string>) {
    return {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };
  }

  beforeEach(() => {
    sessionMemory.clear();
    localMemory.clear();
    vi.stubGlobal('window', {
      sessionStorage: createStorage(sessionMemory),
      localStorage: createStorage(localMemory),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores messages in sessionStorage and draft in localStorage', () => {
    writeStoredFamilyChat({
      messages: [{ id: '1', role: 'user', content: 'Hello' }],
      input: 'draft text',
    });

    expect(sessionMemory.get('okhana.familyChat.messages.v1')).toContain('Hello');
    expect(localMemory.get('okhana.familyChat.draft.v1')).toBe(JSON.stringify('draft text'));
    expect(readStoredFamilyChat()).toEqual({
      messages: [{ id: '1', role: 'user', content: 'Hello' }],
      input: 'draft text',
    });
  });

  it('clears empty draft from localStorage', () => {
    writeStoredFamilyChat({
      messages: [],
      input: 'temporary',
    });
    writeStoredFamilyChat({
      messages: [],
      input: '',
    });

    expect(localMemory.has('okhana.familyChat.draft.v1')).toBe(false);
    expect(readStoredFamilyChat()).toEqual({ messages: [], input: '' });
  });

  it('migrates legacy session payloads into split storage', () => {
    sessionMemory.set(
      'okhana.familyChat.v1',
      JSON.stringify({
        messages: [{ id: '9', role: 'assistant', content: 'Hi' }],
        input: 'legacy draft',
      }),
    );

    expect(readStoredFamilyChat()).toEqual({
      messages: [{ id: '9', role: 'assistant', content: 'Hi' }],
      input: 'legacy draft',
    });
    expect(sessionMemory.has('okhana.familyChat.v1')).toBe(false);
    expect(localMemory.get('okhana.familyChat.draft.v1')).toBe(JSON.stringify('legacy draft'));
  });

  it('ignores malformed payloads', () => {
    sessionMemory.set('okhana.familyChat.messages.v1', '{not-json');
    localMemory.set('okhana.familyChat.draft.v1', '{not-json');
    expect(readStoredFamilyChat()).toEqual({ messages: [], input: '' });
  });
});
