import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findVerticalScrollParent,
  scrollChatToLatest,
} from '@/features/chat/scroll-chat-to-latest';

type FakeEl = {
  parentElement: FakeEl | null;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrollIntoView: ReturnType<typeof vi.fn>;
};

function fakeElement(parent: FakeEl | null = null): FakeEl {
  return {
    parentElement: parent,
    scrollTop: 0,
    scrollHeight: 900,
    clientHeight: 400,
    scrollIntoView: vi.fn(),
  };
}

describe('scrollChatToLatest', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      getComputedStyle: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('scrolls the nearest overflow parent when the chat list is the scroller', () => {
    const column = fakeElement();
    const anchor = fakeElement(column);

    (window.getComputedStyle as ReturnType<typeof vi.fn>).mockImplementation((el: FakeEl) => ({
      overflowY: el === column ? 'auto' : 'visible',
    }));

    expect(findVerticalScrollParent(anchor as unknown as Element)).toBe(column);
    scrollChatToLatest(anchor as unknown as HTMLElement);
    expect(column.scrollTop).toBe(900);
  });

  it('falls back to scrollIntoView when no overflow parent exists', () => {
    const anchor = fakeElement();

    (window.getComputedStyle as ReturnType<typeof vi.fn>).mockReturnValue({
      overflowY: 'visible',
    });

    expect(findVerticalScrollParent(anchor as unknown as Element)).toBeNull();
    scrollChatToLatest(anchor as unknown as HTMLElement);
    expect(anchor.scrollIntoView).toHaveBeenCalledWith({ block: 'end', inline: 'nearest' });
  });
});
