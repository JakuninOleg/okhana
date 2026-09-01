import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTtsEnabledSnapshot,
  setTtsEnabled,
} from '@/features/chat/tts-preference';

describe('tts preference', () => {
  const localMemory = new Map<string, string>();

  beforeEach(() => {
    localMemory.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => localMemory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          localMemory.set(key, value);
        },
        removeItem: (key: string) => {
          localMemory.delete(key);
        },
        clear: () => localMemory.clear(),
      },
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('always reports off for ru even if a legacy true flag exists', () => {
    window.localStorage.setItem('okhana.ttsEnabled.v1', 'true');
    expect(getTtsEnabledSnapshot('ru')).toBe(false);
  });

  it('stores EN preference under a locale-scoped key and ignores ru writes', () => {
    setTtsEnabled(true, 'en');
    expect(window.localStorage.getItem('okhana.ttsEnabled.v1.en')).toBe('true');
    expect(getTtsEnabledSnapshot('en')).toBe(true);

    setTtsEnabled(true, 'ru');
    expect(getTtsEnabledSnapshot('ru')).toBe(false);
    expect(window.localStorage.getItem('okhana.ttsEnabled.v1.ru')).toBeNull();
  });

  it('migrates the legacy global key into the EN-scoped key', () => {
    window.localStorage.setItem('okhana.ttsEnabled.v1', 'true');
    expect(getTtsEnabledSnapshot('en')).toBe(true);
    expect(window.localStorage.getItem('okhana.ttsEnabled.v1.en')).toBe('true');
    expect(window.localStorage.getItem('okhana.ttsEnabled.v1')).toBeNull();
  });
});
