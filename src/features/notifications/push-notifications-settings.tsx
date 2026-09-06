'use client';

import { Bell, BellOff, BellRing, Loader2, Moon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { enableWebPush, type EnableWebPushResult } from '@/features/notifications/enable-web-push';
import {
  loadQuietHoursAction,
  setQuietHoursAction,
} from '@/features/notifications/quiet-hours-actions';

type PushUiStatus = 'loading' | EnableWebPushResult;

function isPushError(status: PushUiStatus): boolean {
  return status === 'error' || status === 'error_subscribe' || status === 'error_sync';
}

export function PushNotificationsSettings(): React.JSX.Element {
  const t = useTranslations('Dashboard.familyHub');
  const [status, setStatus] = useState<PushUiStatus>('loading');
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietLoaded, setQuietLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void enableWebPush().then((result) => {
      if (!cancelled) {
        setStatus(result);
      }
    });
    void loadQuietHoursAction().then((result) => {
      if (cancelled || !result.ok) {
        return;
      }
      setQuietEnabled(result.enabled);
      setQuietLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function enable(): void {
    startTransition(async () => {
      const result = await enableWebPush({ forcePrompt: true });
      setStatus(result);
    });
  }

  function toggleQuiet(next: boolean): void {
    setQuietEnabled(next);
    startTransition(async () => {
      const result = await setQuietHoursAction({ enabled: next });
      if (!result.ok) {
        setQuietEnabled(!next);
      }
    });
  }

  const on = status === 'subscribed' || status === 'already';
  const canEnable = status === 'need' || isPushError(status);

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-background/80 p-2 text-brand-peach">
          {status === 'loading' || pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : on ? (
            <BellRing className="size-4" aria-hidden />
          ) : status === 'denied' || status === 'unsupported' || status === 'missing_vapid' || isPushError(status) ? (
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
              : status === 'already'
                ? t('pushAlready')
                : status === 'subscribed'
                  ? t('pushOn')
                  : status === 'denied'
                    ? t('pushDenied')
                    : status === 'error_subscribe'
                      ? t('pushErrorSubscribe')
                      : status === 'error_sync'
                        ? t('pushErrorSync')
                        : status === 'error'
                          ? t('pushError')
                          : status === 'unsupported' || status === 'missing_vapid'
                            ? t('pushUnsupported')
                            : t('pushDescription')}
          </p>
        </div>
      </div>
      {canEnable ? (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={enable}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {isPushError(status) ? t('pushRetry') : t('pushEnable')}
        </Button>
      ) : null}

      {quietLoaded ? (
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/50 p-3">
          <div className="mt-0.5 rounded-xl bg-muted/60 p-2 text-brand-peach">
            <Moon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">{t('quietTitle')}</h3>
              <Switch
                checked={quietEnabled}
                disabled={pending}
                onCheckedChange={toggleQuiet}
                aria-label={t('quietTitle')}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('quietDescription')}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
