'use client';

import { ThinkingIndicator } from '@/components/ui/thinking-indicator';
import { OkhanaAvatar } from '@/features/chat/okhana-avatar';
import { cn } from '@/lib/utils';

type ChatMessageProps = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
  assistantName: string;
  thinkingLabel: string;
};

export function ChatMessage({
  role,
  content,
  isStreaming = false,
  assistantName,
  thinkingLabel,
}: ChatMessageProps): React.JSX.Element | null {
  if (role === 'system') {
    return null;
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end pl-10">
        <div
          className={cn(
            'max-w-[min(100%,28rem)] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5',
            'text-sm leading-relaxed text-primary-foreground shadow-sm',
          )}
        >
          {content}
        </div>
      </div>
    );
  }

  const showThinking = isStreaming && content.length === 0;

  return (
    <div className="flex gap-3">
      <OkhanaAvatar size="sm" label={assistantName} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{assistantName}</p>
        <div className="text-sm leading-relaxed text-foreground">
          {showThinking ? <ThinkingIndicator label={thinkingLabel} /> : content}
        </div>
      </div>
    </div>
  );
}
