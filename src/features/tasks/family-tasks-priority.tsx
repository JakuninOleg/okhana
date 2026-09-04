'use client';

import { ListTodo } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestFamilyChatSend } from '@/features/chat/family-chat-store';
import { enableWebPush } from '@/features/notifications/enable-web-push';
import type { VisibleTask } from '@/features/tasks/list-tasks';
import { FamilyTasksSheet } from '@/features/tasks/family-tasks-sheet';
import { cn } from '@/lib/utils';

type FamilyTasksPriorityProps = {
  initialTasks: VisibleTask[];
};

function formatDue(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function FamilyTasksPriority({
  initialTasks,
}: FamilyTasksPriorityProps): React.JSX.Element {
  const t = useTranslations('Dashboard.tasks');
  const locale = useLocale();
  const [tasks, setTasks] = useState(initialTasks);
  const [pushHint, setPushHint] = useState<'idle' | 'need' | 'on' | 'unsupported'>('idle');
  // Snapshot once — Date.now() during render trips react-hooks/purity.
  const [nowMs] = useState(() => Date.now());
  const knownIdsRef = useRef(new Set(initialTasks.map((task) => task.id)));

  useEffect(() => {
    void enableWebPush().then((result) => {
      if (result === 'unsupported' || result === 'missing_vapid') {
        setPushHint('unsupported');
        return;
      }
      if (result === 'denied') {
        setPushHint('need');
        return;
      }
      if (result === 'subscribed' || result === 'already') {
        setPushHint('on');
      }
    });
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

  const dueSoon = tasks
    .filter((task) => task.dueAt)
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));

  return (
    <section className="shrink-0 rounded-2xl border border-brand-peach/40 bg-brand-sun/30 p-3 shadow-sm sm:p-4 dark:bg-brand-sun/10">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
            <ListTodo className="size-4 shrink-0 text-brand-peach" aria-hidden />
            {t('priorityTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('prioritySubtitle')}</p>
        </div>
        <FamilyTasksSheet />
      </div>

      {tasks.length === 0 ? (
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
          {tasks.slice(0, 5).map((task) => {
            const due = formatDue(task.dueAt, locale);
            const isUrgent = Boolean(
              task.dueAt && new Date(task.dueAt).getTime() - nowMs < 24 * 60 * 60 * 1000,
            );
            return (
              <li
                key={task.id}
                className={cn(
                  'rounded-xl border border-border/50 bg-background/80 px-3 py-2.5',
                  isUrgent && 'border-brand-peach/60',
                )}
              >
                <p className="text-sm font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    due ? t('dueLabel', { due }) : t('noDue'),
                    task.isCreator ? t('youCreated') : null,
                    task.myAssignment ? t(`status.${task.myAssignment.status}`) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {dueSoon[0]?.dueAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('reminderHint', { title: dueSoon[0].title })}
        </p>
      ) : null}

      {pushHint === 'need' || pushHint === 'unsupported' ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            {pushHint === 'unsupported' ? t('pushUnsupported') : t('pushNeedPermission')}
          </p>
          {pushHint === 'need' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void enableWebPush({ forcePrompt: true }).then((result) => {
                  if (result === 'subscribed' || result === 'already') {
                    setPushHint('on');
                  }
                });
              }}
            >
              {t('pushEnable')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
