'use client';

import { Check, Eye, ListTodo, Loader2, MessageSquarePlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, useTransition } from 'react';
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
import { formatDateTimeMedium } from '@/lib/format-date';
import { cn } from '@/lib/utils';

function formatDue(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateTimeMedium(date, locale);
}

function TaskDetailBody({
  task,
  onAck,
  onComplete,
  pending,
  onBack,
}: {
  task: VisibleTask;
  onAck: (id: number) => void;
  onComplete: (id: number) => void;
  pending: boolean;
  onBack: () => void;
}): React.JSX.Element {
  const t = useTranslations('Dashboard.tasks');
  const locale = useLocale();
  const due = formatDue(task.dueAt, locale);
  const myStatus = task.myAssignment?.status;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      <div className="space-y-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="-ml-2 h-8 px-2 text-muted-foreground"
          onClick={onBack}
        >
          {t('detailBack')}
        </Button>
        <h3 className="text-base font-semibold text-foreground">{task.title}</h3>
        {task.description ? (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        ) : null}
      </div>

      <dl className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 px-3 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t('detailCreatedBy')}</dt>
          <dd className="font-medium text-foreground">
            {task.isCreator ? t('youCreated') : (task.creatorLabel ?? '—')}
          </dd>
        </div>
        {due ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('detailDue')}</dt>
            <dd className="font-medium text-foreground">{due}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t('detailYourStatus')}</dt>
          <dd className="font-medium text-foreground">
            {myStatus ? t(`status.${myStatus}` as 'status.pending') : t('detailNotAssigned')}
          </dd>
        </div>
      </dl>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('detailAssignees')}
        </p>
        <ul className="space-y-2">
          {task.assignees.map((assignee) => (
            <li
              key={assignee.userId}
              className="flex items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-foreground">{assignee.label}</span>
              <span className="text-xs text-muted-foreground">
                {t(`status.${assignee.status}` as 'status.pending')}
                {assignee.seenAt
                  ? ` · ${t('detailSeenAt', { when: formatDue(assignee.seenAt, locale) ?? '' })}`
                  : null}
                {assignee.doneAt
                  ? ` · ${t('detailDoneAt', { when: formatDue(assignee.doneAt, locale) ?? '' })}`
                  : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {myStatus === 'pending' || myStatus === 'seen' ? (
        <div className="flex flex-wrap gap-2">
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
    </div>
  );
}

function TaskRow({
  task,
  onOpenDetail,
  onAck,
  onComplete,
  pending,
}: {
  task: VisibleTask;
  onOpenDetail: (task: VisibleTask) => void;
  onAck: (id: number) => void;
  onComplete: (id: number) => void;
  pending: boolean;
}): React.JSX.Element {
  const t = useTranslations('Dashboard.tasks');
  const locale = useLocale();
  const due = formatDue(task.dueAt, locale);
  const myStatus = task.myAssignment?.status;
  const doneCount = task.assignees.filter((a) => a.status === 'done').length;
  const assigneeNames = task.assignees.map((a) => a.label).join(', ');

  return (
    <li className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3">
      <button
        type="button"
        className="w-full space-y-1 text-left"
        onClick={() => onOpenDetail(task)}
      >
        <p className="text-sm font-medium text-foreground">{task.title}</p>
        {task.description ? (
          <p className="text-sm text-muted-foreground">{task.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {[
            due ? t('dueLabel', { due }) : null,
            task.isCreator
              ? t('youCreated')
              : task.creatorLabel
                ? t('createdBy', { name: task.creatorLabel })
                : null,
            assigneeNames ? t('assignedTo', { names: assigneeNames }) : null,
            t('progress', { done: doneCount, total: task.assignees.length }),
            myStatus ? t(`status.${myStatus}` as 'status.pending') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="pt-1 text-xs font-medium text-primary">{t('openDetail')}</p>
      </button>
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

export type FamilyTasksSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When the sheet opens, jump straight to this task's detail. */
  focusTaskId?: number | null;
};

export function FamilyTasksSheet({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  focusTaskId = null,
}: FamilyTasksSheetProps): React.JSX.Element {
  const t = useTranslations('Dashboard.tasks');
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChangeProp ?? setUncontrolledOpen;
  const [scope, setScope] = useState<'active' | 'completed'>('active');
  const [tasks, setTasks] = useState<VisibleTask[]>([]);
  const [detailTask, setDetailTask] = useState<VisibleTask | null>(null);
  const [error, setError] = useState<TaskActionErrorCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async (
    nextScope: 'active' | 'completed',
    preferredDetailId?: number | null,
  ) => {
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
    if (preferredDetailId != null) {
      setDetailTask(result.tasks.find((task) => task.id === preferredDetailId) ?? null);
      return;
    }
    setDetailTask((current) => {
      if (!current) return null;
      return result.tasks.find((task) => task.id === current.id) ?? null;
    });
  }, []);

  useEffect(() => {
    if (!open || focusTaskId == null) {
      return;
    }
    // Defer setState — sync setState in effect trips react-hooks/set-state-in-effect.
    const timer = window.setTimeout(() => {
      setScope('active');
      void refresh('active', focusTaskId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, focusTaskId, refresh]);

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (next) {
      void refresh(scope, focusTaskId);
    } else {
      setDetailTask(null);
    }
  }

  function switchScope(next: 'active' | 'completed'): void {
    setScope(next);
    setDetailTask(null);
    void refresh(next);
  }

  function onAck(taskId: number): void {
    startTransition(async () => {
      const result = await acknowledgeTaskAction(taskId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh(scope, detailTask?.id ?? null);
    });
  }

  function onComplete(taskId: number): void {
    startTransition(async () => {
      const result = await completeTaskAction(taskId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh(scope, detailTask?.id ?? null);
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
          <SheetTitle>{detailTask ? t('detailTitle') : t('title')}</SheetTitle>
          <SheetDescription>
            {detailTask ? t('detailDescription') : t('description')}
          </SheetDescription>
        </SheetHeader>

        {detailTask ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <TaskDetailBody
              task={detailTask}
              onAck={onAck}
              onComplete={onComplete}
              pending={pending}
              onBack={() => setDetailTask(null)}
            />
          </div>
        ) : (
          <>
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
                      onOpenDetail={setDetailTask}
                      onAck={onAck}
                      onComplete={onComplete}
                      pending={pending}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
