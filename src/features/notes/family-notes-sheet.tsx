'use client';

import { Loader2, MessageSquarePlus, StickyNote } from 'lucide-react';
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
import { HubToolbarIcon, HubToolbarLabel, hubToolbarTriggerClassName } from '@/features/family/hub-toolbar';
import {
  loadVisibleNotesAction,
  updateNoteContentAction,
  updateNotePrivacyAction,
  type NoteActionError,
  type NoteMemberOption,
} from '@/features/notes/note-actions';
import type { VisibleNote } from '@/features/notes/list-notes';
import { formatDateTimeMedium } from '@/lib/format-date';
import { cn } from '@/lib/utils';

function formatCreatedAt(value: Date, locale: string): string {
  return formatDateTimeMedium(value, locale);
}

type PrivacyLevel = VisibleNote['privacyLevel'];

function NoteRow({
  note,
  canManage,
  members,
  pending,
  onSavePrivacy,
  onSaveContent,
}: {
  note: VisibleNote;
  canManage: boolean;
  members: NoteMemberOption[];
  pending: boolean;
  onSavePrivacy: (input: {
    noteId: number;
    privacyLevel: PrivacyLevel;
    hiddenFrom: number[];
  }) => void;
  onSaveContent: (input: { noteId: number; title: string; content: string }) => Promise<boolean>;
}): React.JSX.Element {
  const t = useTranslations('Dashboard.notes');
  const locale = useLocale();
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(note.privacyLevel);
  const [hiddenFrom, setHiddenFrom] = useState<number[]>(note.hiddenFrom ?? []);
  const [editing, setEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [draftContent, setDraftContent] = useState(note.content);
  const [contentPending, startContentTransition] = useTransition();

  function toggleHidden(memberId: number): void {
    setHiddenFrom((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  }

  return (
    <li className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {editingContent ? (
            <div className="space-y-2">
              <input
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                aria-label={t('editTitleLabel')}
              />
              <textarea
                className="min-h-24 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                aria-label={t('editContentLabel')}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || contentPending}
                  onClick={() => {
                    startContentTransition(async () => {
                      const ok = await onSaveContent({
                        noteId: note.id,
                        title: draftTitle,
                        content: draftContent,
                      });
                      if (ok) {
                        setEditingContent(false);
                      }
                    });
                  }}
                >
                  {t('contentSave')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={contentPending}
                  onClick={() => {
                    setDraftTitle(note.title);
                    setDraftContent(note.content);
                    setEditingContent(false);
                  }}
                >
                  {t('privacyCancel')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">{note.title}</p>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{note.content}</p>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {[
              note.createdBy != null
                ? t('createdBy', {
                  name: members.find((member) => member.id === note.createdBy)?.label ?? '—',
                })
                : null,
              t(`category.${note.category}`),
              t(`privacy.${note.privacyLevel}`),
              formatCreatedAt(note.createdAt, locale),
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {canManage && !editingContent ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setEditingContent(true);
                setEditing(false);
                setDraftTitle(note.title);
                setDraftContent(note.content);
              }}
            >
              {t('contentEdit')}
            </Button>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? t('privacyCancel') : t('privacyEdit')}
            </Button>
          ) : null}
        </div>
      </div>

      {editing && canManage ? (
        <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
          <p className="text-xs font-medium text-foreground">{t('privacyLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {(['public', 'adults_only', 'personal'] as const).map((level) => (
              <Button
                key={level}
                type="button"
                size="sm"
                variant={privacyLevel === level ? 'default' : 'outline'}
                className={cn(privacyLevel === level && 'pointer-events-none')}
                onClick={() => {
                  setPrivacyLevel(level);
                  if (level === 'personal') {
                    setHiddenFrom([]);
                  }
                }}
              >
                {t(`privacy.${level}`)}
              </Button>
            ))}
          </div>
          {privacyLevel !== 'personal' && members.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('hideFromLabel')}</p>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => {
                  const active = hiddenFrom.includes(member.id);
                  return (
                    <Button
                      key={member.id}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => toggleHidden(member.id)}
                    >
                      {member.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() => {
              onSavePrivacy({
                noteId: note.id,
                privacyLevel,
                hiddenFrom: privacyLevel === 'personal' ? [] : hiddenFrom,
              });
              setEditing(false);
            }}
          >
            {t('privacySave')}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function FamilyNotesSheet(): React.JSX.Element {
  const t = useTranslations('Dashboard.notes');
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<VisibleNote[]>([]);
  const [members, setMembers] = useState<NoteMemberOption[]>([]);
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
    setMembers(result.members);
    setCurrentUserId(result.currentUserId);
    setFamilyRole(result.familyRole);
  }, [t]);

  function onSavePrivacy(input: {
    noteId: number;
    privacyLevel: PrivacyLevel;
    hiddenFrom: number[];
  }): void {
    startTransition(async () => {
      setError(null);
      const result = await updateNotePrivacyAction(input);
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      await refresh();
    });
  }

  async function onSaveContent(input: {
    noteId: number;
    title: string;
    content: string;
  }): Promise<boolean> {
    setError(null);
    const result = await updateNoteContentAction(input);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return false;
    }
    await refresh();
    return true;
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
      <SheetTrigger className={hubToolbarTriggerClassName()} aria-label={t('open')}>
        <HubToolbarIcon>
          <StickyNote />
        </HubToolbarIcon>
        <HubToolbarLabel>{t('shortLabel')}</HubToolbarLabel>
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
            <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-brand-sun/20 px-3 py-8 text-center dark:bg-brand-peach/10">
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
              <p className="text-xs text-muted-foreground">{t('createHint')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => {
                const canManage =
                  familyRole === 'owner'
                  || familyRole === 'adult'
                  || (currentUserId !== null && note.createdBy === currentUserId);
                return (
                  <NoteRow
                    key={`${note.id}-${note.privacyLevel}-${(note.hiddenFrom ?? []).join(',')}`}
                    note={note}
                    canManage={canManage}
                    members={members}
                    pending={pending}
                    onSavePrivacy={onSavePrivacy}
                    onSaveContent={onSaveContent}
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
