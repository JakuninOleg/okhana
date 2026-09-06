'use client';

import { CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  createCalendarEventAction,
  deleteCalendarEventAction,
  loadFamilyCalendarAction,
  type CalendarActionError,
} from '@/features/calendar/calendar-actions';
import type { FamilyEventRecord } from '@/features/calendar/list-events';
import type { FamilyDateRecord } from '@/features/family/family-date-utils';

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatEventWhen(event: FamilyEventRecord, locale: string): string {
  const start = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
  if (event.allDay) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(start);
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(start);
}

export function FamilyCalendarSheet(): React.JSX.Element {
  const t = useTranslations('Dashboard.calendar');
  const tDates = useTranslations('Dashboard.familyDates');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<FamilyEventRecord[]>([]);
  const [dates, setDates] = useState<FamilyDateRecord[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(() => toDatetimeLocalValue(new Date()));

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const result = await loadFamilyCalendarAction();
    setLoading(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}` as `errors.${CalendarActionError}`));
      return;
    }
    setEvents(result.events);
    setDates(result.dates);
    setCanManage(result.canManage);
  }, [t]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          void refresh();
        } else {
          setShowForm(false);
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
        <CalendarDays className="size-4" />
      </SheetTrigger>
      <SheetContent side="center" className="flex flex-col gap-0 overflow-hidden">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {canManage ? (
            <Button
              type="button"
              size="sm"
              className="w-full"
              variant={showForm ? 'outline' : 'default'}
              onClick={() => setShowForm((value) => !value)}
            >
              <Plus className="size-3.5" />
              {showForm ? t('cancelAdd') : t('add')}
            </Button>
          ) : null}

          {showForm && canManage ? (
            <form
              className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  setError(null);
                  const result = await createCalendarEventAction({
                    title,
                    description: description.trim() || undefined,
                    startTime: new Date(startTime).toISOString(),
                    allDay: false,
                  });
                  if (!result.ok) {
                    setError(t(`errors.${result.error}`));
                    return;
                  }
                  setTitle('');
                  setDescription('');
                  setShowForm(false);
                  await refresh();
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="cal-title">{t('titleLabel')}</Label>
                <Input
                  id="cal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cal-start">{t('startLabel')}</Label>
                <Input
                  id="cal-start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cal-desc">{t('descriptionLabel')}</Label>
                <Input
                  id="cal-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {t('save')}
              </Button>
            </form>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('loading')}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-brand-peach">
                  {t('upcomingEvents')}
                </h3>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('emptyEvents')}</p>
                ) : (
                  <ul className="space-y-2">
                    {events.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatEventWhen(item, locale)}
                          </p>
                          {item.description ? (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          ) : null}
                        </div>
                        {canManage ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending}
                            aria-label={t('delete')}
                            onClick={() => {
                              startTransition(async () => {
                                setError(null);
                                const result = await deleteCalendarEventAction({
                                  eventId: item.id,
                                });
                                if (!result.ok) {
                                  setError(t(`errors.${result.error}`));
                                  return;
                                }
                                await refresh();
                              });
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-brand-peach">
                  {t('recurringDates')}
                </h3>
                {dates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('emptyDates')}</p>
                ) : (
                  <ul className="space-y-2">
                    {dates.slice(0, 8).map((item) => (
                      <li
                        key={item.id}
                        className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3"
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            tDates(`kind.${item.kind}`),
                            tDates('nextOn', { date: item.nextOccurrence }),
                          ].join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
