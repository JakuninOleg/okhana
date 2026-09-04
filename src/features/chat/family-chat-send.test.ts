import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushFamilyChatSend,
  requestFamilyChatSend,
  subscribeFamilyChatSend,
} from '@/features/chat/family-chat-store';

describe('requestFamilyChatSend', () => {
  beforeEach(() => {
    const target = new EventTarget();
    vi.stubGlobal('window', {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatches trimmed text to subscribers that accept it', () => {
    const received: string[] = [];
    const unsubscribe = subscribeFamilyChatSend((text) => {
      received.push(text);
      return true;
    });

    requestFamilyChatSend('  Создать поручение  ');
    requestFamilyChatSend('   ');

    expect(received).toEqual(['Создать поручение']);
    unsubscribe();
  });

  it('keeps text queued when the subscriber declines', () => {
    const first = vi.fn(() => false);
    const unsubscribe = subscribeFamilyChatSend(first);
    requestFamilyChatSend('Создать поручение');
    expect(first).toHaveBeenCalledWith('Создать поручение');

    unsubscribe();
    const received: string[] = [];
    const unsubscribe2 = subscribeFamilyChatSend((text) => {
      received.push(text);
      return true;
    });
    flushFamilyChatSend();
    expect(received).toEqual(['Создать поручение']);
    unsubscribe2();
  });

  it('stops notifying after unsubscribe', () => {
    const handler = vi.fn(() => true);
    const unsubscribe = subscribeFamilyChatSend(handler);
    unsubscribe();
    requestFamilyChatSend('Создать поручение');
    expect(handler).not.toHaveBeenCalled();
  });
});
