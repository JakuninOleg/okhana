'use client';

import { Loader2, Mic, Send, Square, Volume2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useEffectEvent, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isConfidentlyEnglish } from '@/features/ai/english-guard';
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
import { playChatSpeech } from '@/features/chat/play-chat-speech';
import { readOpenAiChatStream } from '@/features/chat/read-openai-stream';
import {
  getServerTtsEnabledSnapshot,
  getTtsEnabledSnapshot,
  setTtsEnabled,
  subscribeTtsEnabled,
} from '@/features/chat/tts-preference';
import { useVoiceRecorder } from '@/features/chat/use-voice-recorder';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export type { FamilyChatMessage };

type ChatStatus = 'idle' | 'loadingHistory' | 'streaming' | 'error';

const sttLanguageByLocale = {
  ru: 'ru',
  en: 'en',
} satisfies Record<Locale, string>;

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function FamilyChat(): React.JSX.Element {
  const t = useTranslations('Dashboard.voiceChat');
  const locale = useLocale() as Locale;
  const chat = useSyncExternalStore(
    subscribeFamilyChat,
    getFamilyChatSnapshot,
    getServerFamilyChatSnapshot,
  );
  const ttsEnabled = useSyncExternalStore(
    subscribeTtsEnabled,
    () => getTtsEnabledSnapshot(locale),
    getServerTtsEnabledSnapshot,
  );
  const { messages, input } = chat;
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const submitFromVoice = useEffectEvent((text: string) => {
    void submitMessage(text);
  });

  const voice = useVoiceRecorder({
    language: sttLanguageByLocale[locale],
    disabled: status === 'streaming',
    onTranscript: (text) => {
      setErrorMessage(null);
      submitFromVoice(text);
    },
    onError: (message) => {
      setErrorMessage(message);
      setStatus('error');
    },
  });

  const scrollToBottom = useEffectEvent(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    list.scrollTop = list.scrollHeight;
  });

  useEffect(() => {
    scrollToBottom();
  }, [messages, status, voice.phase]);

  useEffect(() => {
    const existing = getFamilyChatSnapshot();
    if (existing.messages.length > 0 || existing.input.length > 0) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
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
      speechAbortRef.current?.abort();
      voice.stop();
    };
  }, []);

  async function maybeSpeakAssistant(text: string): Promise<void> {
    if (locale !== 'en' || !getTtsEnabledSnapshot('en') || !isConfidentlyEnglish(text)) {
      return;
    }

    speechAbortRef.current?.abort();
    const controller = new AbortController();
    speechAbortRef.current = controller;

    const result = await playChatSpeech({
      text,
      locale: 'en',
      signal: controller.signal,
    });

    if (!result.ok && !controller.signal.aborted) {
      setErrorMessage(result.error);
    }
  }

  async function submitMessage(overrideText?: string): Promise<void> {
    const snapshot = getFamilyChatSnapshot();
    const text = (overrideText ?? snapshot.input).trim();
    if (!text || statusRef.current === 'streaming') {
      return;
    }

    voice.stop();
    updateFamilyChatInput('');
    setErrorMessage(null);

    const userMessage: FamilyChatMessage = {
      id: createLocalId('user'),
      role: 'user',
      content: text,
    };
    const assistantId = createLocalId('assistant');
    const nextMessages = [...snapshot.messages, userMessage];
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
      const assistantText = getFamilyChatSnapshot().messages.find(
        (message) => message.id === assistantId,
      )?.content ?? '';
      void maybeSpeakAssistant(assistantText);
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
    speechAbortRef.current?.abort();
    setStatus('idle');
  }

  const busy = status === 'streaming' || voice.phase === 'transcribing';
  const recording = voice.phase === 'recording' || voice.phase === 'warning';

  const statusLine =
    voice.phase === 'transcribing'
      ? t('statusTranscribing')
      : voice.phase === 'warning'
        ? t('statusRecordingWarn')
        : voice.phase === 'recording'
          ? t('statusRecording')
          : status === 'streaming'
            ? t('statusThinking')
            : status === 'loadingHistory'
              ? t('loadingHistory')
              : t('statusReady');

  return (
    <TooltipProvider>
      <Card className="w-full max-w-2xl gap-0 overflow-hidden border-border/60 bg-card/90 py-0 shadow-sm backdrop-blur-sm">
        <CardHeader className="gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <OkhanaAvatar size="lg" label={t('assistantName')} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {t('eyebrow')}
                  </p>
                  <CardTitle className="text-xl tracking-tight">{t('title')}</CardTitle>
                  <CardDescription>{t('description')}</CardDescription>
                </div>
                {locale === 'en' ? (
                  <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1.5">
                    <Volume2 className="size-3.5 text-muted-foreground" aria-hidden />
                    <Label htmlFor="okhana-tts-toggle" className="text-xs text-muted-foreground">
                      {t('ttsToggle')}
                    </Label>
                    <Switch
                      id="okhana-tts-toggle"
                      checked={ttsEnabled}
                      onCheckedChange={(checked) => setTtsEnabled(checked, 'en')}
                      aria-label={t('ttsToggle')}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {statusLine}
                </p>
                {recording ? (
                  <Badge variant={voice.phase === 'warning' ? 'destructive' : 'secondary'}>
                    {formatElapsed(voice.elapsedMs)}
                  </Badge>
                ) : null}
                {locale === 'en' && ttsEnabled ? (
                  <Badge variant="outline">{t('ttsOnHint')}</Badge>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 py-0">
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
        </CardContent>

        {errorMessage ? (
          <p className="px-5 pb-2 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <CardFooter className="flex-col items-stretch gap-2 border-border/60 bg-muted/20 px-3 py-3 dark:bg-muted/10">
          <div
            className={cn(
              'flex items-end gap-2 rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm',
              'dark:bg-background/80',
              recording && 'border-destructive/40 ring-2 ring-destructive/15',
            )}
          >
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant={recording ? 'destructive' : 'ghost'}
                    size="icon"
                    disabled={!voice.supported || busy}
                    onPointerDown={(event) => {
                      if (event.button !== 0) {
                        return;
                      }
                      event.preventDefault();
                      voice.pressStart();
                    }}
                    onPointerUp={() => voice.pressEnd()}
                    onPointerCancel={() => voice.pressEnd()}
                    onPointerLeave={() => {
                      if (recording) {
                        voice.pressEnd();
                      }
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                    aria-label={t('voiceInput')}
                    className="shrink-0 touch-none rounded-xl select-none"
                  />
                }
              >
                {voice.phase === 'transcribing' ? <Loader2 className="animate-spin" /> : <Mic />}
              </TooltipTrigger>
              <TooltipContent>
                {voice.supported ? t('voiceHold') : t('voiceUnsupported')}
              </TooltipContent>
            </Tooltip>

            <Textarea
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
              rows={1}
              className="min-h-10 max-h-32 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"
            />

            {status === 'streaming' ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={stopStreaming}
                      aria-label={t('stopResponse')}
                      className="shrink-0 rounded-xl"
                    />
                  }
                >
                  <Square />
                </TooltipTrigger>
                <TooltipContent>{t('stopResponse')}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => void submitMessage()}
                      disabled={!input.trim() || busy}
                      aria-label={t('send')}
                      className="shrink-0 rounded-xl"
                    />
                  }
                >
                  <Send />
                </TooltipTrigger>
                <TooltipContent>{t('send')}</TooltipContent>
              </Tooltip>
            )}
          </div>
          {recording ? (
            <p className="px-1 text-xs text-muted-foreground">
              {voice.phase === 'warning' ? t('recordingWarnHint') : t('recordingHint')}
            </p>
          ) : (
            <p className="px-1 text-xs text-muted-foreground">{t('voiceHoldHint')}</p>
          )}
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
