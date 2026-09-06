'use client';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  // Fresh copy so Chromium gets a plain ArrayBuffer-backed key (not a pooled view).
  return new Uint8Array(output);
}

export type EnableWebPushResult =
  | 'unsupported'
  | 'missing_vapid'
  | 'denied'
  | 'need'
  | 'subscribed'
  | 'already'
  | 'error'
  | 'error_subscribe'
  | 'error_sync';

async function syncSubscription(subscription: PushSubscription): Promise<boolean> {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  return response.ok;
}

async function subscribePush(
  registration: ServiceWorkerRegistration,
  applicationServerKey: Uint8Array<ArrayBuffer>,
): Promise<PushSubscription> {
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (firstError) {
    // Already subscribed / stale FCM registration — drop and retry once.
    const stale = await registration.pushManager.getSubscription();
    await stale?.unsubscribe().catch(() => undefined);
    try {
      return await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    } catch {
      throw firstError;
    }
  }
}

export async function enableWebPush(options?: {
  forcePrompt?: boolean;
}): Promise<EnableWebPushResult> {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const configResponse = await fetch('/api/push/subscribe');
    if (!configResponse.ok) {
      return 'missing_vapid';
    }
    const config = (await configResponse.json()) as { configured?: boolean; publicKey?: string };
    const publicKey = config.publicKey?.trim();
    if (!config.configured || !publicKey) {
      return 'missing_vapid';
    }

    let permission = Notification.permission;
    // Browser only shows the system prompt from a user gesture (button click).
    if (permission === 'default' && options?.forcePrompt) {
      permission = await Notification.requestPermission();
    }
    if (permission === 'denied') {
      return 'denied';
    }
    if (permission !== 'granted') {
      // Still 'default' — waiting for the user to click Enable.
      return 'need';
    }

    // Dev skips SW register in PwaRegister — register here when enabling push.
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Never call subscribe() again while a subscription exists — Chromium throws
      // AbortError: "Registration failed - push service error".
      const synced = await syncSubscription(existing);
      return synced ? 'already' : 'error_sync';
    }

    // Quiet status checks must not create a subscription (needs a user gesture).
    if (!options?.forcePrompt) {
      return 'need';
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    // Uncompressed P-256 public key is 65 bytes; anything else will fail subscribe.
    if (applicationServerKey.byteLength !== 65) {
      return 'missing_vapid';
    }

    let subscription: PushSubscription;
    try {
      subscription = await subscribePush(registration, applicationServerKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[okhana] push subscribe failed: ${message}`);
      return 'error_subscribe';
    }

    return (await syncSubscription(subscription)) ? 'subscribed' : 'error_sync';
  } catch (error) {
    // Log a plain string only — Next.js dev overlay treats console.error(Error) as a crash.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[okhana] enableWebPush failed: ${message}`);
    return 'error';
  }
}
