'use client';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function LocaleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale: currentLocale } = useParams<{ locale: string }>();

  return (
    <div className="flex gap-0.5 rounded-md border p-0.5">
      {routing.locales.map((locale) => (
        <Button
          key={locale}
          variant={locale === currentLocale ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={locale === currentLocale}
          onClick={() => router.replace(pathname, { locale })}
        >
          {locale.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}