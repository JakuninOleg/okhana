'use client';

import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { enableWebPush, type EnableWebPushResult } from '@/features/notifications/enable-web-push';

type PushUiStatus = 'loading' | EnableWebPushResult;

function statusFromResult(result: EnableWebPushResult): PushUiStatus {
  return result;
}

export function PushNotificationsSettings(): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');
  const [status, setStatus] = useState<PushUiStatus>('loading');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void enableWebPush().then((result) => {
      if (!cancelled) {
        setStatus(statusFromResult(result));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function enable(): void {
    startTransition(async () => {
      const result = await enableWebPush({ forcePrompt: true });
      setStatus(statusFromResult(result));
    });
  }

  const on = status === 'subscribed' || status === 'already';

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-background/80 p-2 text-brand-peach">
          {status === 'loading' || pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : on ? (
            <BellRing className="size-4" aria-hidden />
          ) : status === 'denied' || status === 'unsupported' || status === 'missing_vapid' ? (
            <BellOff className="size-4" aria-hidden />
          ) : (
            <Bell className="size-4" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-sm font-medium">{t('pushTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {status === 'loading'
              ? t('pushChecking')
              : on
                ? t('pushOn')
                : status === 'denied'
                  ? t('pushDenied')
                  : status === 'unsupported' || status === 'missing_vapid'
                    ? t('pushUnsupported')
                    : t('pushDescription')}
          </p>
        </div>
      </div>
      {!on && status !== 'loading' && status !== 'unsupported' && status !== 'missing_vapid' ? (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={pending || status === 'denied'}
          onClick={enable}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {t('pushEnable')}
        </Button>
      ) : null}
    </div>
  );
}
