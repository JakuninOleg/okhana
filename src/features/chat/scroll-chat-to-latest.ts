/**
 * Nearest ancestor styled as a vertical scrollport (`overflow-y: auto|scroll`).
 * Prefer this over `scrollIntoView` so desktop chat-list scroll works.
 */
export function findVerticalScrollParent(start: Element | null): HTMLElement | null {
  let parent = start?.parentElement ?? null;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/** Pin the chat thread to the latest message inside page or chat-list scrollports. */
export function scrollChatToLatest(anchor: HTMLElement | null): void {
  if (!anchor) {
    return;
  }

  const scrollParent = findVerticalScrollParent(anchor);
  if (scrollParent) {
    scrollParent.scrollTop = scrollParent.scrollHeight;
    return;
  }

  anchor.scrollIntoView({ block: 'end', inline: 'nearest' });
}
