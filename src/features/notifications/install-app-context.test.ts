import { describe, expect, it } from 'vitest';
import {
  detectInstallPlatform,
  INSTALL_WIZARD_STORAGE_KEY,
  isStandaloneDisplay,
  readWizardDismissedAt,
  shouldOfferInstallWizard,
  writeWizardDismissedAt,
} from '@/features/notifications/install-app-context';

describe('install-app-context', () => {
  it('detects iOS and Android from UA', () => {
    expect(
      detectInstallPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' }),
    ).toBe('ios');
    expect(
      detectInstallPlatform({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe('ios');
    expect(
      detectInstallPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }),
    ).toBe('android');
    expect(
      detectInstallPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }),
    ).toBe('desktop');
  });

  it('detects standalone display modes', () => {
    expect(
      isStandaloneDisplay({
        matchMedia: (query) => ({ matches: query.includes('standalone') }),
      }),
    ).toBe(true);
    expect(
      isStandaloneDisplay({
        matchMedia: () => ({ matches: false }),
        navigatorStandalone: true,
      }),
    ).toBe(true);
    expect(
      isStandaloneDisplay({
        matchMedia: () => ({ matches: false }),
        navigatorStandalone: false,
      }),
    ).toBe(false);
  });

  it('snoozes wizard after dismiss and skips when fully set up', () => {
    expect(
      shouldOfferInstallWizard({
        dismissedAt: 1_000,
        nowMs: 1_000 + 1_000,
        standalone: false,
        pushReady: false,
        platform: 'ios',
      }),
    ).toBe(false);
    expect(
      shouldOfferInstallWizard({
        dismissedAt: null,
        nowMs: 10_000,
        standalone: true,
        pushReady: true,
        platform: 'android',
      }),
    ).toBe(false);
    expect(
      shouldOfferInstallWizard({
        dismissedAt: null,
        nowMs: 10_000,
        standalone: true,
        pushReady: false,
        platform: 'ios',
      }),
    ).toBe(true);
  });

  it('never offers the phone install wizard on desktop', () => {
    expect(
      shouldOfferInstallWizard({
        dismissedAt: null,
        nowMs: 10_000,
        standalone: false,
        pushReady: false,
        platform: 'desktop',
      }),
    ).toBe(false);
  });

  it('persists and reads dismiss timestamps safely', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(readWizardDismissedAt(storage)).toBeNull();
    writeWizardDismissedAt(storage, 42);
    expect(readWizardDismissedAt(storage)).toBe(42);
    store.set(INSTALL_WIZARD_STORAGE_KEY, 'nope');
    expect(readWizardDismissedAt(storage)).toBeNull();
  });
});
