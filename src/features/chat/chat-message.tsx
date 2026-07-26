'use client';

import { Loader2, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThinkingIndicator } from '@/components/ui/thinking-indicator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isConfidentlyEnglish } from '@/features/ai/english-guard';
import { OkhanaAvatar } from '@/features/chat/okhana-avatar';
import { cn } from '@/lib/utils';

type ChatMessageProps = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
  assistantName: string;
  thinkingLabel: string;
  speakLabel: string;
  speakingLabel: string;
  speakUnavailableLabel: string;
  locale: 'en' | 'ru';
  ttsEnabled: boolean;
};

export function ChatMessage({
  role,
  content,
  isStreaming = false,
  assistantName,
  thinkingLabel,
  speakLabel,
  speakingLabel,
  speakUnavailableLabel,
  locale,
  ttsEnabled,
}: ChatMessageProps): React.JSX.Element | null {
  const [speaking, setSpeaking] = useState(false);

  if (role === 'system') {
    return null;
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end pl-12">
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
  const canSpeak =
    ttsEnabled
    && locale === 'en'
    && !isStreaming
    && content.trim().length > 0
    && isConfidentlyEnglish(content);

  async function playSpeech(): Promise<void> {
    if (!canSpeak || speaking) {
      return;
    }
    setSpeaking(true);
    try {
      const response = await fetch('/api/chat/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, locale }),
      });
      if (!response.ok || !response.body) {
        return;
      }
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <div className="group flex gap-3">
      <OkhanaAvatar size="sm" label={assistantName} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{assistantName}</p>
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {showThinking ? <ThinkingIndicator label={thinkingLabel} /> : content}
        </div>
        {ttsEnabled && locale === 'en' && !showThinking && content.trim() ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={!canSpeak || speaking}
                  onClick={() => void playSpeech()}
                  aria-label={canSpeak ? speakLabel : speakUnavailableLabel}
                  className="mt-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                />
              }
            >
              {speaking ? <Loader2 className="animate-spin" /> : <Volume2 />}
            </TooltipTrigger>
            <TooltipContent>
              {speaking ? speakingLabel : canSpeak ? speakLabel : speakUnavailableLabel}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
