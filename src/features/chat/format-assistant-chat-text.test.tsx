import { describe, expect, it } from 'vitest';
import { formatAssistantChatText } from '@/features/chat/format-assistant-chat-text';

describe('formatAssistantChatText', () => {
  it('turns **bold** into a strong element', () => {
    const nodes = formatAssistantChatText('Saved **note** ok');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toBe('Saved ');
    expect(nodes[2]).toBe(' ok');
    const bold = nodes[1] as { type: string; props: { children: string } };
    expect(bold.type).toBe('strong');
    expect(bold.props.children).toBe('note');
  });

  it('leaves plain text unchanged', () => {
    expect(formatAssistantChatText('Hello family')).toEqual(['Hello family']);
  });
});
