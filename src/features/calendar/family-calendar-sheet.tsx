'use client';

import { enGB, ru } from 'date-fns/locale';
import { CalendarDays, Loader2, MessageSquarePlus, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { formatClientNowIso } from '@/features/calendar/calendar-time';
import type { FamilyEventRecord } from '@/features/calendar/list-events';
import { requestFamilyChatSend } from '@/features/chat/family-chat-store';
import { HubToolbarIcon, HubToolbarLabel, hubToolbarTriggerClassName } from '@/features/family/hub-toolbar';
import type { FamilyDateRecord } from '@/features/family/family-date-utils';
import type { MemberBirthdayRecord } from '@/features/family/list-member-birthdays';
import {
  formatDateMedium,
  formatIsoYmd,
  formatTimeShort,
  formatWeekdayLong,
} from '@/lib/format-date';
import { cn } from '@/lib/utils';

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function defaultStartForDay(day: Date): string {
  const next = startOfLocalDay(day);
  next.setHours(10, 0, 0, 0);
  return toDatetimeLocalValue(next);
}

function localYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function eventLocalYmd(event: FamilyEventRecord): string {
  const start = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
  return localYmd(start);
}

function monthDayOnDate(
  day: Date,
  item: { month: number; day: number },
): boolean {
  return day.getMonth() + 1 === item.month && day.getDate() === item.day;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return localYmd(a) === localYmd(b);
}

function formatEventWhen(event: FamilyEventRecord, locale: string): string {
  const start = event.startTime instanceof Date ? event.startTime : new Date(event.startTime);
  if (event.allDay) {
    return formatDateMedium(start, locale);
  }
  return formatTimeShort(start, locale);
}

export function FamilyCalendarSheet(): React.JSX.Element {
  const t = useTranslations('Dashboard.calendar');
  const tDates = useTranslations('Dashboard.familyDates');
  const locale = useLocale();
  const dayPickerLocale = locale === 'ru' ? ru : enGB;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfLocalDay(new Date()));
  const [selected, setSelected] = useState<Date>(() => startOfLocalDay(new Date()));
  const [events, setEvents] = useState<FamilyEventRecord[]>([]);
  const [dates, setDates] = useState<FamilyDateRecord[]>([]);
  const [memberBirthdays, setMemberBirthdays] = useState<MemberBirthdayRecord[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(() => defaultStartForDay(new Date()));

  const refresh = useCallback(
    async (visibleMonth?: Date): Promise<void> => {
      const anchor = visibleMonth ?? month;
      setLoading(true);
      setError(null);
      const result = await loadFamilyCalendarAction({
        clientNow: formatClientNowIso(),
        year: anchor.getFullYear(),
        month: anchor.getMonth() + 1,
      });
      setLoading(false);
      if (!result.ok) {
        setError(t(`errors.${result.error}` as `errors.${CalendarActionError}`));
        return;
      }
      setEvents(result.events);
      setDates(result.dates);
      setMemberBirthdays(result.memberBirthdays);
      setCanManage(result.canManage);
    },
    [month, t],
  );

  const daysWithItems = useMemo(() => {
    const keys = new Set<string>();
    for (const event of events) {
      keys.add(eventLocalYmd(event));
    }
    const recurring = [...dates, ...memberBirthdays];
    // Mark every occurrence of memorable dates / birthdays in the visible month grid.
    const cursor = new Date(month.getFullYear(), month.getMonth(), 1 - 7);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 7);
    while (cursor < end) {
      for (const item of recurring) {
        if (monthDayOnDate(cursor, item)) {
          keys.add(localYmd(cursor));
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }, [dates, events, memberBirthdays, month]);

  const dayEvents = useMemo(
    () => events.filter((event) => eventLocalYmd(event) === localYmd(selected)),
    [events, selected],
  );

  const dayDates = useMemo(
    () => dates.filter((item) => monthDayOnDate(selected, item)),
    [dates, selected],
  );

  const dayBirthdays = useMemo(
    () => memberBirthdays.filter((item) => monthDayOnDate(selected, item)),
    [memberBirthdays, selected],
  );

  const markedDays = useMemo(
    () =>
      [...daysWithItems].map((key) => {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
      }),
    [daysWithItems],
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const today = startOfLocalDay(new Date());
          setMonth(today);
          setSelected(today);
          setStartTime(defaultStartForDay(today));
          void refresh(today);
        } else {
          setShowForm(false);
          setError(null);
        }
      }}
    >
      <SheetTrigger className={hubToolbarTriggerClassName()} aria-label={t('open')}>
        <HubToolbarIcon>
          <CalendarDays />
        </HubToolbarIcon>
        <HubToolbarLabel>{t('shortLabel')}</HubToolbarLabel>
      </SheetTrigger>
      <SheetContent side="center" className="flex flex-col gap-0 overflow-hidden">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <Calendar
            mode="single"
            locale={dayPickerLocale}
            month={month}
            selected={selected}
            onSelect={(day) => {
              if (!day) {
                return;
              }
              setSelected(startOfLocalDay(day));
              setStartTime(defaultStartForDay(day));
            }}
            onMonthChange={(next) => {
              const nextMonth = startOfLocalDay(next);
              setMonth(nextMonth);
              void refresh(nextMonth);
            }}
            modifiers={{ hasItems: markedDays }}
            modifiersClassNames={{
              hasItems:
                'relative after:absolute after:bottom-1 after:left-1/2 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-brand-peach',
            }}
            className={cn('w-full rounded-2xl border border-border/60 bg-background/70 p-2 [--cell-size:--spacing(9)]')}
            classNames={{
              root: 'w-full',
              month: 'w-full',
              month_grid: 'w-full',
              week: 'mt-1 flex w-full',
              weekday: 'flex-1 text-center text-[0.7rem] text-muted-foreground',
              day: 'flex-1 p-0',
            }}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium capitalize">
                {formatWeekdayLong(selected, locale)}
              </h3>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant={showForm ? 'outline' : 'default'}
                  onClick={() => {
                    setStartTime(defaultStartForDay(selected));
                    setShowForm((value) => !value);
                  }}
                >
                  <Plus className="size-3.5" />
                  {showForm ? t('cancelAdd') : t('add')}
                </Button>
              ) : null}
            </div>

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
                      startTime: formatClientNowIso(new Date(startTime)),
                      allDay: false,
                    });
                    if (!result.ok) {
                      setError(t(`errors.${result.error}`));
                      return;
                    }
                    setTitle('');
                    setDescription('');
                    setShowForm(false);
                    await refresh(month);
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
          </div>

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
                  {t('dayEvents')}
                </h3>
                {dayEvents.length === 0 ? (
                  <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-brand-sun/20 px-3 py-5 text-center dark:bg-brand-peach/10">
                    <p className="text-sm text-muted-foreground">{t('emptyDayEvents')}</p>
                    <p className="text-xs text-muted-foreground">{t('emptyEventsHint')}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setOpen(false);
                        requestFamilyChatSend(t('createEventViaChat'));
                      }}
                    >
                      <MessageSquarePlus className="size-3.5" />
                      {t('askOkhanaEvent')}
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {dayEvents.map((item) => (
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
                                await refresh(month);
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
                  {t('dayDates')}
                </h3>
                {dayDates.length === 0 && dayBirthdays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('emptyDayDates')}</p>
                ) : (
                  <ul className="space-y-2">
                    {dayBirthdays.map((item) => (
                      <li
                        key={`birthday-${item.userId}`}
                        className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3"
                      >
                        <p className="text-sm font-medium">
                          {t('memberBirthday', { name: item.displayName })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            tDates('kind.birthday'),
                            sameLocalDay(selected, new Date())
                              ? tDates('nextOn', {
                                  date: formatIsoYmd(item.nextOccurrence, locale),
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </li>
                    ))}
                    {dayDates.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3"
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            tDates(`kind.${item.kind}`),
                            sameLocalDay(selected, new Date())
                              ? tDates('nextOn', {
                                  date: formatIsoYmd(item.nextOccurrence, locale),
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
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
