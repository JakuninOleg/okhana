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

function isVerticalScrollport(el: HTMLElement): boolean {
  const overflowY = window.getComputedStyle(el).overflowY;
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
}

/**
 * Pin the chat thread to the latest message.
 * Prefer an explicit message-list scrollport (desktop); otherwise walk from `anchor`
 * (mobile page scroll / footer target).
 */
export function scrollChatToLatest(
  anchor: HTMLElement | null,
  preferredScrollport?: HTMLElement | null,
): void {
  if (preferredScrollport && isVerticalScrollport(preferredScrollport)) {
    preferredScrollport.scrollTop = preferredScrollport.scrollHeight;
    return;
  }

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
