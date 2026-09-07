'use client';

import { Bell, Home, Loader2, Share } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { enableWebPush, type EnableWebPushResult } from '@/features/notifications/enable-web-push';
import {
  detectInstallPlatform,
  isStandaloneDisplay,
  readWizardDismissedAt,
  shouldOfferInstallWizard,
  writeWizardDismissedAt,
  type InstallPlatform,
} from '@/features/notifications/install-app-context';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const OPEN_DELAY_MS = 1600;

/**
 * Soft onboarding: add Okhana icon to the phone + enable notifications.
 * Phone-only — desktop users manage push in family settings.
 */
export function InstallAppWizard(): React.JSX.Element | null {
  const t = useTranslations('Dashboard.installWizard');
  const tPush = useTranslations('Dashboard.familyHub');
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [standalone, setStandalone] = useState(false);
  const [pushStatus, setPushStatus] = useState<EnableWebPushResult | 'loading'>('loading');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onBeforeInstall = (event: Event): void => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    let cancelled = false;
    // Defer all client detection + setState out of the effect body so we do not
    // trip react-hooks/set-state-in-effect (sync setState → cascading render).
    const timer = window.setTimeout(() => {
      void (async () => {
        const nextPlatform = detectInstallPlatform({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
        });
        // Install wizard is phone-only; desktop push lives in family settings.
        if (nextPlatform === 'desktop') {
          return;
        }
        const nextStandalone = isStandaloneDisplay({
          matchMedia: (query) => window.matchMedia(query),
          navigatorStandalone: Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
        });
        const push = await enableWebPush();
        if (cancelled) {
          return;
        }
        setPlatform(nextPlatform);
        setStandalone(nextStandalone);
        setPushStatus(push);
        const pushReady = push === 'subscribed' || push === 'already';
        const dismissedAt = readWizardDismissedAt(window.localStorage);
        if (
          shouldOfferInstallWizard({
            dismissedAt,
            nowMs: Date.now(),
            standalone: nextStandalone,
            pushReady,
            platform: nextPlatform,
          })
        ) {
          setOpen(true);
        }
      })();
    }, OPEN_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  function dismiss(): void {
    writeWizardDismissedAt(window.localStorage);
    setOpen(false);
  }

  function enablePush(): void {
    startTransition(async () => {
      const result = await enableWebPush({ forcePrompt: true });
      setPushStatus(result);
      if (
        (result === 'subscribed' || result === 'already')
        && (standalone || deferredPrompt === null)
      ) {
        // If already on home screen (or no install prompt), closing after push is enough.
        if (standalone) {
          writeWizardDismissedAt(window.localStorage);
          setOpen(false);
        }
      }
    });
  }

  function installNative(): void {
    startTransition(async () => {
      if (!deferredPrompt) {
        return;
      }
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => undefined);
      setDeferredPrompt(null);
      const nextStandalone = isStandaloneDisplay({
        matchMedia: (query) => window.matchMedia(query),
        navigatorStandalone: Boolean(
          (navigator as Navigator & { standalone?: boolean }).standalone,
        ),
      });
      setStandalone(nextStandalone);
    });
  }

  const pushOn = pushStatus === 'subscribed' || pushStatus === 'already';
  const pushCanEnable =
    pushStatus === 'need'
    || pushStatus === 'error'
    || pushStatus === 'error_subscribe'
    || pushStatus === 'error_sync';

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          dismiss();
          return;
        }
        setOpen(true);
      }}
    >
      <SheetContent
        side="center"
        className="max-h-[min(92dvh,40rem)] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('subtitle')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-xl bg-background/80 p-2.5 text-brand-peach">
                <Home className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-sm font-medium">{t('installTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {standalone ? t('installDone') : t(`installHint.${platform}`)}
                </p>
              </div>
            </div>

            {!standalone && platform === 'ios' ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>{t('iosStep1')}</li>
                <li className="flex flex-wrap items-center gap-1">
                  <span>{t('iosStep2Before')}</span>
                  <Share className="inline size-3.5 shrink-0" aria-hidden />
                  <span>{t('iosStep2After')}</span>
                </li>
                <li>{t('iosStep3')}</li>
              </ol>
            ) : null}

            {!standalone && platform === 'android' && !deferredPrompt ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>{t('androidStep1')}</li>
                <li>{t('androidStep2')}</li>
              </ol>
            ) : null}

            {!standalone && platform === 'desktop' && !deferredPrompt ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>{t('desktopStep1')}</li>
                <li>{t('desktopStep2')}</li>
              </ol>
            ) : null}

            {!standalone && deferredPrompt ? (
              <Button
                type="button"
                variant="cta"
                className="w-full font-semibold"
                disabled={pending}
                onClick={installNative}
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {t('installButton')}
              </Button>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 rounded-xl bg-background/80 p-2.5 text-brand-peach">
                <Bell className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-sm font-medium">{tPush('pushTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {pushStatus === 'loading'
                    ? tPush('pushChecking')
                    : pushOn
                      ? tPush(pushStatus === 'already' ? 'pushAlready' : 'pushOn')
                      : pushStatus === 'denied'
                        ? tPush('pushDenied')
                        : pushStatus === 'unsupported' || pushStatus === 'missing_vapid'
                          ? tPush('pushUnsupported')
                          : pushStatus === 'error_subscribe'
                            ? tPush('pushErrorSubscribe')
                            : pushStatus === 'error_sync'
                              ? tPush('pushErrorSync')
                              : pushStatus === 'error'
                                ? tPush('pushError')
                                : t('pushWhy')}
                </p>
              </div>
            </div>
            {pushCanEnable ? (
              <Button
                type="button"
                variant="cta"
                className="w-full font-semibold"
                disabled={pending}
                onClick={enablePush}
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {pushStatus.startsWith('error') ? tPush('pushRetry') : tPush('pushEnable')}
              </Button>
            ) : null}
          </section>

          <Button type="button" variant="outline" className="w-full" onClick={dismiss}>
            {t('later')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
