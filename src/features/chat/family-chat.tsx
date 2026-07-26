'use client';

import { Loader2, Mic, Send, Square } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useEffectEvent, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from '@/features/chat/chat-message';
import type { FamilyChatMessage } from '@/features/chat/family-chat-storage';
import {
  getFamilyChatSnapshot,
  getServerFamilyChatSnapshot,
  replaceFamilyChatSnapshot,
  subscribeFamilyChat,
  updateFamilyChatInput,
  updateFamilyChatMessages,
} from '@/features/chat/family-chat-store';
import { OkhanaAvatar } from '@/features/chat/okhana-avatar';
import { readOpenAiChatStream } from '@/features/chat/read-openai-stream';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export type { FamilyChatMessage };

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEvent = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const speechLanguageByLocale = {
  ru: 'ru-RU',
  en: 'en-US',
} satisfies Record<Locale, string>;

type ChatStatus = 'idle' | 'loadingHistory' | 'streaming' | 'error';

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function subscribeNever(): () => void {
  return () => undefined;
}

function getSpeechSupported(): boolean {
  const browserWindow = window as WindowWithSpeechRecognition;
  return Boolean(browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition);
}

function getSpeechSupportedServer(): boolean {
  return false;
}

export function FamilyChat(): React.JSX.Element {
  const t = useTranslations('Dashboard.voiceChat');
  const locale = useLocale() as Locale;
  const chat = useSyncExternalStore(
    subscribeFamilyChat,
    getFamilyChatSnapshot,
    getServerFamilyChatSnapshot,
  );
  const { messages, input } = chat;
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const speechSupported = useSyncExternalStore(
    subscribeNever,
    getSpeechSupported,
    getSpeechSupportedServer,
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useEffectEvent(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    list.scrollTop = list.scrollHeight;
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  useEffect(() => {
    const existing = getFamilyChatSnapshot();
    if (existing.messages.length > 0 || existing.input.length > 0) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    // Don't block the composer forever if Supabase/VPN stalls the history request.
    const timeoutId = window.setTimeout(() => controller.abort(), 6_000);

    async function loadHistory(): Promise<void> {
      setStatus('loadingHistory');
      try {
        const response = await fetch('/api/chat/history', { signal: controller.signal });
        if (!response.ok || cancelled) {
          return;
        }
        const data = (await response.json()) as { messages?: FamilyChatMessage[] };
        if (cancelled) {
          return;
        }
        replaceFamilyChatSnapshot({
          messages: data.messages ?? [],
          input: getFamilyChatSnapshot().input,
        });
      } catch {
        // Abort, timeout, or network — start with an empty thread.
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) {
          setStatus('idle');
        }
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
    };
  }, []);

  function createSpeechRecognition(): SpeechRecognition | null {
    const browserWindow = window as WindowWithSpeechRecognition;
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      return null;
    }

    const speechRecognition = new Recognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = speechLanguageByLocale[locale];
    speechRecognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      updateFamilyChatInput(transcript.trim());
    };
    speechRecognition.onend = () => setIsListening(false);
    speechRecognition.onerror = () => setIsListening(false);
    return speechRecognition;
  }

  async function submitMessage(): Promise<void> {
    const text = input.trim();
    if (!text || status === 'streaming') {
      return;
    }

    updateFamilyChatInput('');
    setErrorMessage(null);
    setIsListening(false);
    recognitionRef.current?.stop();

    const userMessage: FamilyChatMessage = {
      id: createLocalId('user'),
      role: 'user',
      content: text,
    };
    const assistantId = createLocalId('assistant');
    const nextMessages = [...messages, userMessage];
    replaceFamilyChatSnapshot({
      messages: [...nextMessages, { id: assistantId, role: 'assistant', content: '' }],
      input: '',
    });
    setStatus('streaming');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          locale,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? t('requestFailed'));
      }
      if (!response.body) {
        throw new Error(t('streamUnavailable'));
      }

      await readOpenAiChatStream(
        response.body,
        (delta) => {
          updateFamilyChatMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message,
            ),
          );
        },
        controller.signal,
      );

      setStatus('idle');
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus('idle');
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : t('requestFailed'));
      setStatus('error');
      updateFamilyChatMessages((current) =>
        current.filter((message) => message.id !== assistantId || message.content.length > 0),
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  function stopStreaming(): void {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  }

  function toggleListening(): void {
    if (!speechSupported) {
      return;
    }
    const recognition = recognitionRef.current ?? createSpeechRecognition();
    if (!recognition) {
      return;
    }
    recognitionRef.current = recognition;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }
    recognition.start();
    setIsListening(true);
  }

  const busy = status === 'streaming';
  const statusLine =
    status === 'streaming' ? t('statusThinking') : status === 'loadingHistory' ? t('loadingHistory') : t('statusReady');

  return (
    <section
      className={cn(
        'flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl',
        'border border-border/60 bg-background/80 shadow-sm',
        'dark:bg-background/60',
      )}
    >
      <header className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <OkhanaAvatar size="lg" label={t('assistantName')} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t('eyebrow')}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{t('title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
          <p className="mt-2 text-xs text-muted-foreground/90" aria-live="polite">
            {statusLine}
          </p>
        </div>
      </header>

      <div
        ref={listRef}
        className="h-[26rem] space-y-5 overflow-y-auto px-4 py-5 sm:px-5"
        aria-live="polite"
      >
        {status === 'loadingHistory' ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('loadingHistory')}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <OkhanaAvatar size="lg" label={t('assistantName')} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{t('emptyTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('emptyHistory')}</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              isStreaming={status === 'streaming'}
              assistantName={t('assistantName')}
              thinkingLabel={t('thinking')}
            />
          ))
        )}
      </div>

      {errorMessage ? (
        <p className="px-5 pb-2 text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="border-t border-border/60 bg-muted/20 p-3 backdrop-blur-sm dark:bg-muted/10">
        <div
          className={cn(
            'flex items-center gap-2 rounded-2xl border border-border/70 bg-background/90 p-1.5 shadow-sm',
            'dark:bg-background/80',
          )}
        >
          <Button
            type="button"
            variant={isListening ? 'destructive' : 'ghost'}
            size="icon"
            disabled={!speechSupported || busy}
            onClick={toggleListening}
            aria-label={t('voiceInput')}
            title={speechSupported ? t('voiceInput') : t('voiceUnsupported')}
            className="shrink-0 rounded-xl"
          >
            <Mic />
          </Button>
          <Input
            value={input}
            onChange={(event) => updateFamilyChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            placeholder={t('placeholder')}
            disabled={busy}
            aria-label={t('placeholder')}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          {status === 'streaming' ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={stopStreaming}
              aria-label={t('stopResponse')}
              className="shrink-0 rounded-xl"
            >
              <Square />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={() => void submitMessage()}
              disabled={!input.trim() || busy}
              aria-label={t('send')}
              className="shrink-0 rounded-xl"
            >
              <Send />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
