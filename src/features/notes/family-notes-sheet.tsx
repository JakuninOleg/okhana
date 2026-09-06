'use client';

import { Loader2, MessageSquarePlus, StickyNote, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { requestFamilyChatSend } from '@/features/chat/family-chat-store';
import {
  deleteNoteAction,
  loadVisibleNotesAction,
  type NoteActionError,
} from '@/features/notes/note-actions';
import type { VisibleNote } from '@/features/notes/list-notes';

function formatCreatedAt(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value instanceof Date ? value : new Date(value));
}

function NoteRow({
  note,
  canDelete,
  pending,
  onDelete,
}: {
  note: VisibleNote;
  canDelete: boolean;
  pending: boolean;
  onDelete: (id: number) => void;
}): React.JSX.Element {
  const t = useTranslations('Dashboard.notes');
  const locale = useLocale();

  return (
    <li className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{note.title}</p>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{note.content}</p>
          <p className="text-xs text-muted-foreground">
            {[
              t(`category.${note.category}`),
              t(`privacy.${note.privacyLevel}`),
              formatCreatedAt(note.createdAt, locale),
            ].join(' · ')}
          </p>
        </div>
        {canDelete ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            aria-label={t('delete')}
            onClick={() => onDelete(note.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function FamilyNotesSheet(): React.JSX.Element {
  const t = useTranslations('Dashboard.notes');
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<VisibleNote[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [familyRole, setFamilyRole] = useState<'owner' | 'adult' | 'child' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const result = await loadVisibleNotesAction();
    setLoading(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}` as `errors.${NoteActionError}`));
      return;
    }
    setNotes(result.notes);
    setCurrentUserId(result.currentUserId);
    setFamilyRole(result.familyRole);
  }, [t]);

  function onDelete(noteId: number): void {
    startTransition(async () => {
      setError(null);
      const result = await deleteNoteAction({ noteId });
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      await refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          void refresh();
        } else {
          setError(null);
        }
      }}
    >
      <SheetTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t('open')}
            className="shrink-0"
          />
        }
      >
        <StickyNote className="size-4" />
      </SheetTrigger>
      <SheetContent side="center" className="flex flex-col gap-0 overflow-hidden">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pt-4">
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => {
              setOpen(false);
              requestFamilyChatSend(t('createViaChat'));
            }}
          >
            <MessageSquarePlus className="size-3.5" />
            {t('create')}
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('loading')}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : notes.length === 0 ? (
            <div className="space-y-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
              <p className="text-xs text-muted-foreground">{t('createHint')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => {
                const canDelete =
                  familyRole === 'owner'
                  || familyRole === 'adult'
                  || (currentUserId !== null && note.createdBy === currentUserId);
                return (
                  <NoteRow
                    key={note.id}
                    note={note}
                    canDelete={canDelete}
                    pending={pending}
                    onDelete={onDelete}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
