export type InstallPlatform = 'ios' | 'android' | 'desktop';

export const INSTALL_WIZARD_STORAGE_KEY = 'okhana.installWizard.dismissedAt';
/** Don't re-prompt for two weeks after dismiss. */
export const INSTALL_WIZARD_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export function isStandaloneDisplay(input?: {
  matchMedia?: (query: string) => { matches: boolean };
  navigatorStandalone?: boolean;
}): boolean {
  const matchMedia = input?.matchMedia;
  if (matchMedia?.('(display-mode: standalone)').matches) {
    return true;
  }
  if (matchMedia?.('(display-mode: fullscreen)').matches) {
    return true;
  }
  return Boolean(input?.navigatorStandalone);
}

export function detectInstallPlatform(input: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}): InstallPlatform {
  const ua = input.userAgent;
  const platform = input.platform ?? '';
  const maxTouchPoints = input.maxTouchPoints ?? 0;

  // iPadOS 13+ reports as MacIntel with touch.
  if (
    /iPad|iPhone|iPod/i.test(ua)
    || (platform === 'MacIntel' && maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

export function readWizardDismissedAt(storage: {
  getItem: (key: string) => string | null;
}): number | null {
  const raw = storage.getItem(INSTALL_WIZARD_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function writeWizardDismissedAt(
  storage: { setItem: (key: string, value: string) => void },
  atMs: number = Date.now(),
): void {
  storage.setItem(INSTALL_WIZARD_STORAGE_KEY, String(atMs));
}

export function shouldOfferInstallWizard(input: {
  dismissedAt: number | null;
  nowMs: number;
  standalone: boolean;
  pushReady: boolean;
  /** Phone-only: desktop users get push controls in family settings instead. */
  platform: InstallPlatform;
}): boolean {
  if (input.platform === 'desktop') {
    return false;
  }
  if (
    input.dismissedAt !== null
    && input.nowMs - input.dismissedAt < INSTALL_WIZARD_SNOOZE_MS
  ) {
    return false;
  }
  // Already looks like an installed app and push works — nothing to sell.
  if (input.standalone && input.pushReady) {
    return false;
  }
  return true;
}
