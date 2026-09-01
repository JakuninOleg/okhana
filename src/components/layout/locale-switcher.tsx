'use client';

import { useTransition } from 'react';
import { useParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LocaleSwitcher(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { locale: currentLocale } = useParams<{ locale: string }>();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        'flex gap-0.5 rounded-md border p-0.5 transition-opacity',
        isPending && 'pointer-events-none opacity-60',
      )}
      aria-busy={isPending}
    >
      {routing.locales.map((locale) => (
        <Button
          key={locale}
          variant={locale === currentLocale ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={locale === currentLocale || isPending}
          onClick={() => {
            startTransition(() => {
              router.replace(pathname, { locale });
            });
          }}
        >
          {locale.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
