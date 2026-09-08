'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ThinkingIndicator } from '@/components/ui/thinking-indicator';
import { OkhanaAvatar } from '@/features/chat/okhana-avatar';
import {
  deleteOwnChatMessageAction,
  editOwnChatMessageAction,
} from '@/features/chat/chat-message-actions';
import { formatAssistantChatText } from '@/features/chat/format-assistant-chat-text';
import { cn } from '@/lib/utils';

type ChatMessageProps = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
  assistantName: string;
  thinkingLabel: string;
  /** Persist edits/deletes for own user messages that already have a DB id. */
  onContentChange?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
};

function isPersistedDbId(id: string): boolean {
  return /^\d+$/.test(id);
}

export function ChatMessage({
  id = '',
  role,
  content,
  isStreaming = false,
  assistantName,
  thinkingLabel,
  onContentChange,
  onDelete,
}: ChatMessageProps): React.JSX.Element | null {
  const t = useTranslations('Dashboard.chat');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  if (role === 'system') {
    return null;
  }

  if (role === 'user') {
    const canManage = isPersistedDbId(id) && Boolean(onContentChange && onDelete);

    return (
      <div className="flex justify-end pl-12">
        <div className="max-w-[min(100%,28rem)] space-y-1.5">
          {editing ? (
            <div className="space-y-2 rounded-2xl rounded-br-md border border-border bg-background p-2.5 shadow-sm">
              <textarea
                className="min-h-20 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={t('editMessageLabel')}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || draft.trim().length === 0}
                  onClick={() => {
                    startTransition(async () => {
                      setActionError(null);
                      const result = await editOwnChatMessageAction({
                        messageId: Number(id),
                        content: draft.trim(),
                      });
                      if (!result.ok) {
                        setActionError(t(`messageErrors.${result.error}`));
                        return;
                      }
                      onContentChange?.(id, result.content);
                      setEditing(false);
                    });
                  }}
                >
                  {t('saveMessage')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setDraft(content);
                    setEditing(false);
                    setActionError(null);
                  }}
                >
                  {t('cancelEditMessage')}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5',
                'text-sm leading-relaxed text-primary-foreground shadow-sm',
              )}
            >
              {content}
            </div>
          )}
          {canManage && !editing ? (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                aria-label={t('editMessage')}
                onClick={() => {
                  setDraft(content);
                  setEditing(true);
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                aria-label={t('deleteMessage')}
                onClick={() => {
                  startTransition(async () => {
                    setActionError(null);
                    const result = await deleteOwnChatMessageAction({
                      messageId: Number(id),
                    });
                    if (!result.ok) {
                      setActionError(t(`messageErrors.${result.error}`));
                      return;
                    }
                    onDelete?.(id);
                  });
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ) : null}
          {actionError ? (
            <p className="text-right text-xs text-destructive" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const showThinking = isStreaming && content.length === 0;

  return (
    <div className="flex gap-3">
      <OkhanaAvatar size="sm" label={assistantName} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{assistantName}</p>
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {showThinking
            ? <ThinkingIndicator label={thinkingLabel} />
            : formatAssistantChatText(content)}
        </div>
      </div>
    </div>
  );
}
