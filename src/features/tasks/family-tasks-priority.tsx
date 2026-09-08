'use client';

import { ListTodo } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestFamilyChatSend } from '@/features/chat/family-chat-store';
import { enableWebPush } from '@/features/notifications/enable-web-push';
import type { VisibleTask } from '@/features/tasks/list-tasks';
import { FamilyTasksSheet } from '@/features/tasks/family-tasks-sheet';
import {
  isTaskDueTodayOrTomorrow,
  selectPriorityTasks,
} from '@/features/tasks/priority-tasks';
import { formatDateTimeMedium } from '@/lib/format-date';
import { cn } from '@/lib/utils';

type FamilyTasksPriorityProps = {
  initialTasks: VisibleTask[];
};

function formatDue(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateTimeMedium(date, locale);
}

export function FamilyTasksPriority({
  initialTasks,
}: FamilyTasksPriorityProps): React.JSX.Element {
  const t = useTranslations('Dashboard.tasks');
  const locale = useLocale();
  const [tasks, setTasks] = useState(initialTasks);
  // Snapshot once — Date.now() during render trips react-hooks/purity.
  const [nowMs] = useState(() => Date.now());
  const knownIdsRef = useRef(new Set(initialTasks.map((task) => task.id)));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);

  useEffect(() => {
    // Quietly refresh an existing subscription; enable UI lives in family settings.
    void enableWebPush();
  }, []);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;

    const connect = (): void => {
      if (disposed) return;
      source = new EventSource('/api/tasks/events');

      source.addEventListener('tasks', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { tasks?: VisibleTask[] };
          const next = payload.tasks ?? [];
          const previous = knownIdsRef.current;
          const newcomers = next.filter((task) => !previous.has(task.id) && task.myAssignment);

          // Page Notification only when tab is hidden — avoids duplicate with Web Push
          // while the dashboard is focused.
          for (const task of newcomers) {
            if (
              typeof Notification !== 'undefined'
              && Notification.permission === 'granted'
              && document.visibilityState === 'hidden'
            ) {
              new Notification(t('pushTitle'), {
                body: task.title,
                tag: `task-${task.id}`,
              });
            }
          }

          knownIdsRef.current = new Set(next.map((task) => task.id));
          setTasks(next);
        } catch {
          // ignore malformed SSE payloads
        }
      });

      // Server closes after ~55s; reopen so live updates keep flowing.
      source.addEventListener('reconnect', () => {
        source?.close();
        source = null;
        connect();
      });
    };

    connect();
    return () => {
      disposed = true;
      source?.close();
    };
  }, [t]);

  const now = new Date(nowMs);
  const displayTasks = selectPriorityTasks(tasks, now, 5);
  const dueSoon = displayTasks.find((task) => task.dueAt);

  function openTaskDetail(taskId: number): void {
    setFocusTaskId(taskId);
    setSheetOpen(true);
  }

  return (
    <section className="shrink-0 rounded-2xl border border-brand-peach/40 bg-brand-sun/30 p-3 shadow-sm sm:p-4 dark:border-brand-peach/50 dark:bg-brand-sun/15">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
            <ListTodo className="size-4 shrink-0 text-brand-peach" aria-hidden />
            {t('priorityTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('prioritySubtitle')}</p>
        </div>
        <FamilyTasksSheet
          open={sheetOpen}
          onOpenChange={(next) => {
            setSheetOpen(next);
            if (!next) {
              setFocusTaskId(null);
            }
          }}
          focusTaskId={focusTaskId}
        />
      </div>

      {displayTasks.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('priorityEmpty')}</p>
          <Button
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => requestFamilyChatSend(t('createViaChat'))}
          >
            {t('create')}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {displayTasks.map((task) => {
            const due = formatDue(task.dueAt, locale);
            const isUrgent = isTaskDueTodayOrTomorrow(task.dueAt, now);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-xl border border-border/50 bg-background/80 px-3 py-2.5 text-left transition-colors',
                    'hover:border-brand-peach/50 hover:bg-background',
                    isUrgent && 'border-brand-peach/60',
                  )}
                  onClick={() => openTaskDetail(task.id)}
                >
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      isUrgent ? t('priorityUrgent') : null,
                      due ? t('dueLabel', { due }) : t('noDue'),
                      task.isCreator ? t('youCreated') : null,
                      task.myAssignment ? t(`status.${task.myAssignment.status}`) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {dueSoon?.dueAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('reminderHint', { title: dueSoon.title })}
        </p>
      ) : null}
    </section>
  );
}
