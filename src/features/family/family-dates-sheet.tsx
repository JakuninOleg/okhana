'use client';

import { CalendarHeart, Loader2, Plus, Trash2 } from 'lucide-react';
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
  createFamilyDateAction,
  deleteFamilyDateAction,
  loadFamilyDatesAction,
  type FamilyDateActionError,
} from '@/features/family/date-actions';
import {
  FAMILY_DATE_KINDS,
  type FamilyDateKind,
  type FamilyDateRecord,
} from '@/features/family/family-date-utils';
import { cn } from '@/lib/utils';

function formatMonthDay(month: number, day: number, locale: string): string {
  const date = new Date(2024, month - 1, day);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
}

function DateRow({
  item,
  canManage,
  pending,
  onDelete,
}: {
  item: FamilyDateRecord;
  canManage: boolean;
  pending: boolean;
  onDelete: (id: number) => void;
}): React.JSX.Element {
  const t = useTranslations('Dashboard.familyDates');
  const locale = useLocale();

  return (
    <li className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {[
              t(`kind.${item.kind}`),
              formatMonthDay(item.month, item.day, locale),
              item.year ? t('sinceYear', { year: item.year }) : null,
              t('nextOn', { date: item.nextOccurrence }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {item.notes ? (
            <p className="text-sm text-muted-foreground">{item.notes}</p>
          ) : null}
        </div>
        {canManage ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            aria-label={t('delete')}
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function FamilyDatesSheet(): React.JSX.Element {
  const t = useTranslations('Dashboard.familyDates');
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState<FamilyDateRecord[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<FamilyDateKind>('anniversary');
  const [month, setMonth] = useState('1');
  const [day, setDay] = useState('1');
  const [year, setYear] = useState('');
  const [notes, setNotes] = useState('');

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const result = await loadFamilyDatesAction();
    setLoading(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}` as `errors.${FamilyDateActionError}`));
      return;
    }
    setDates(result.dates);
    setCanManage(result.canManage);
  }, [t]);

  function mapError(code: FamilyDateActionError): string {
    return t(`errors.${code}`);
  }

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
        <CalendarHeart className="size-4" />
      </SheetTrigger>
      <SheetContent side="center" className="flex flex-col gap-0 overflow-hidden">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {canManage ? (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant={showForm ? 'outline' : 'default'}
                onClick={() => setShowForm((value) => !value)}
              >
                <Plus className="size-3.5" />
                {showForm ? t('cancelAdd') : t('add')}
              </Button>
            </div>
          ) : null}

          {showForm && canManage ? (
            <form
              className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  setError(null);
                  const result = await createFamilyDateAction({
                    title,
                    kind,
                    month: Number(month),
                    day: Number(day),
                    year: year.trim() === '' ? '' : Number(year),
                    notes: notes.trim() || undefined,
                  });
                  if (!result.ok) {
                    setError(mapError(result.error));
                    return;
                  }
                  setTitle('');
                  setKind('anniversary');
                  setMonth('1');
                  setDay('1');
                  setYear('');
                  setNotes('');
                  setShowForm(false);
                  await refresh();
                });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="family-date-title">{t('titleLabel')}</Label>
                <Input
                  id="family-date-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t('titlePlaceholder')}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="family-date-kind">{t('kindLabel')}</Label>
                <select
                  id="family-date-kind"
                  className={cn(
                    'flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm',
                    'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
                  )}
                  value={kind}
                  onChange={(event) => setKind(event.target.value as FamilyDateKind)}
                >
                  {FAMILY_DATE_KINDS.map((option) => (
                    <option key={option} value={option}>
                      {t(`kind.${option}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="family-date-day">{t('dayLabel')}</Label>
                  <Input
                    id="family-date-day"
                    type="number"
                    min={1}
                    max={31}
                    value={day}
                    onChange={(event) => setDay(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="family-date-month">{t('monthLabel')}</Label>
                  <Input
                    id="family-date-month"
                    type="number"
                    min={1}
                    max={12}
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="family-date-year">{t('yearLabel')}</Label>
                  <Input
                    id="family-date-year"
                    type="number"
                    min={1900}
                    max={2100}
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    placeholder={t('yearOptional')}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="family-date-notes">{t('notesLabel')}</Label>
                <Input
                  id="family-date-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t('notesPlaceholder')}
                  maxLength={2000}
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending || !title.trim()}>
                {pending ? t('saving') : t('save')}
              </Button>
            </form>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('loading')}
            </div>
          ) : dates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <ul className="space-y-2">
              {dates.map((item) => (
                <DateRow
                  key={item.id}
                  item={item}
                  canManage={canManage}
                  pending={pending}
                  onDelete={(id) => {
                    startTransition(async () => {
                      setError(null);
                      const result = await deleteFamilyDateAction(id);
                      if (!result.ok) {
                        setError(mapError(result.error));
                        return;
                      }
                      await refresh();
                    });
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
