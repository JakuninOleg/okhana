import type { ReactNode } from 'react';

/**
 * Lightweight inline markdown for assistant bubbles — bold, italic, code.
 * Avoids a heavy markdown dependency while stopping raw `**` from showing.
 */
export function formatAssistantChatText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: ** before *, then `code`, else plain.
  const token = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = token.exec(text);
  let key = 0;

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const chunk = match[0];
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      nodes.push(
        <strong key={`b-${key}`} className="font-semibold text-foreground">
          {chunk.slice(2, -2)}
        </strong>,
      );
    } else if (chunk.startsWith('*') && chunk.endsWith('*')) {
      nodes.push(
        <em key={`i-${key}`} className="italic">
          {chunk.slice(1, -1)}
        </em>,
      );
    } else if (chunk.startsWith('`') && chunk.endsWith('`')) {
      nodes.push(
        <code
          key={`c-${key}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {chunk.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(chunk);
    }
    key += 1;
    lastIndex = match.index + chunk.length;
    match = token.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
