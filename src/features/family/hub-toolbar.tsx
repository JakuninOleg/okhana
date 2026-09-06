'use client';

import { Children } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Full-width hub toolbar cell trigger (native SheetTrigger, not shadcn Button). */
export function hubToolbarTriggerClassName(className?: string): string {
  return cn(
    'flex h-full min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1.5 self-stretch',
    'rounded-xl px-2 py-3',
    'text-muted-foreground transition-colors',
    'hover:bg-background/90 hover:text-foreground dark:hover:bg-background/60',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    className,
  );
}

export function HubToolbarIcon({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center [&_svg]:size-5">
      {children}
    </span>
  );
}

export function HubToolbarLabel({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="w-full truncate px-1 text-center text-xs font-medium leading-none">
      {children}
    </span>
  );
}

/** 2×2 equal tool tiles — roomier than a cramped 4-up row. */
export function HubToolbar({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');

  return (
    <nav
      className="grid w-full grid-cols-2 gap-1.5 rounded-2xl border border-border/70 bg-muted/50 p-1.5 dark:border-border dark:bg-muted/80"
      aria-label={t('toolsNav')}
    >
      {Children.map(children, (child) => (
        <div className="min-w-0 [&_[data-slot=sheet-trigger]]:flex [&_[data-slot=sheet-trigger]]:h-full [&_[data-slot=sheet-trigger]]:min-h-16 [&_[data-slot=sheet-trigger]]:w-full">
          {child}
        </div>
      ))}
    </nav>
  );
}
