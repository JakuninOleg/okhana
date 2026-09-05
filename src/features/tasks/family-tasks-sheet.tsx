'use client';

import { Check, Eye, ListTodo, Loader2, MessageSquarePlus } from 'lucide-react';
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
  acknowledgeTaskAction,
  completeTaskAction,
  loadMyTasksAction,
  type TaskActionErrorCode,
} from '@/features/tasks/task-actions';
import type { VisibleTask } from '@/features/tasks/list-tasks';
import { cn } from '@/lib/utils';

function formatDue(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function TaskRow({
  task,
  onAck,
  onComplete,
  pending,
}: {
  task: VisibleTask;
  onAck: (id: number) => void;
  onComplete: (id: number) => void;
  pending: boolean;
}): React.JSX.Element {
  const t = useTranslations('Dashboard.tasks');
  const locale = useLocale();
  const due = formatDue(task.dueAt, locale);
  const myStatus = task.myAssignment?.status;
  const doneCount = task.assignees.filter((a) => a.status === 'done').length;

  return (
    <li className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{task.title}</p>
        {task.description ? (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {[
            due ? t('dueLabel', { due }) : null,
            task.isCreator ? t('youCreated') : null,
            t('progress', { done: doneCount, total: task.assignees.length }),
            myStatus ? t(`status.${myStatus}` as 'status.pending') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {myStatus === 'pending' || myStatus === 'seen' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {myStatus === 'pending' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => onAck(task.id)}
            >
              <Eye className="size-3.5" />
              {t('markSeen')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => onComplete(task.id)}
          >
            <Check className="size-3.5" />
            {t('markDone')}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function FamilyTasksSheet(): React.JSX.Element {
  const t = useTranslations('Dashboard.tasks');
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'active' | 'completed'>('active');
  const [tasks, setTasks] = useState<VisibleTask[]>([]);
  const [error, setError] = useState<TaskActionErrorCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async (nextScope: 'active' | 'completed') => {
    setLoading(true);
    setError(null);
    const result = await loadMyTasksAction(nextScope);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setTasks([]);
      return;
    }
    setTasks(result.tasks);
  }, []);

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (next) {
      void refresh(scope);
    }
  }

  function switchScope(next: 'active' | 'completed'): void {
    setScope(next);
    void refresh(next);
  }

  function onAck(taskId: number): void {
    startTransition(async () => {
      const result = await acknowledgeTaskAction(taskId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh(scope);
    });
  }

  function onComplete(taskId: number): void {
    startTransition(async () => {
      const result = await completeTaskAction(taskId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh(scope);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-full"
            aria-label={t('open')}
          />
        }
      >
        <ListTodo className="size-4" />
        <span className="hidden sm:inline">{t('openShort')}</span>
      </SheetTrigger>
      <SheetContent side="center" className="flex flex-col overflow-hidden">
        <SheetHeader className="border-b border-border/60 pb-4">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={scope === 'active' ? 'default' : 'outline'}
              className={cn(scope === 'active' && 'pointer-events-none')}
              onClick={() => switchScope('active')}
            >
              {t('tabActive')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === 'completed' ? 'default' : 'outline'}
              className={cn(scope === 'completed' && 'pointer-events-none')}
              onClick={() => switchScope('completed')}
            >
              {t('tabCompleted')}
            </Button>
          </div>
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
              {t(`errors.${error}`)}
            </p>
          ) : tasks.length === 0 ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
              <p className="text-xs text-muted-foreground">{t('createHint')}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onAck={onAck}
                  onComplete={onComplete}
                  pending={pending}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
