'use client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export type EnableWebPushResult =
  | 'unsupported'
  | 'missing_vapid'
  | 'denied'
  | 'subscribed'
  | 'already'
  | 'error';

export async function enableWebPush(options?: {
  forcePrompt?: boolean;
}): Promise<EnableWebPushResult> {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  const configResponse = await fetch('/api/push/subscribe');
  if (!configResponse.ok) {
    return 'missing_vapid';
  }
  const config = (await configResponse.json()) as { configured?: boolean; publicKey?: string };
  if (!config.configured || !config.publicKey) {
    return 'missing_vapid';
  }

  let permission = Notification.permission;
  if (permission === 'default' && options?.forcePrompt) {
    permission = await Notification.requestPermission();
  }
  if (permission === 'denied') {
    return 'denied';
  }
  if (permission !== 'granted') {
    return 'denied';
  }

  // Dev skips SW register in PwaRegister — register here when enabling push.
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing && !options?.forcePrompt) {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existing.toJSON()),
    });
    return 'already';
  }

  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
  });

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });

  return response.ok ? 'subscribed' : 'error';
}
