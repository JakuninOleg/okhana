'use client';

import { useEffect } from 'react';

/**
 * Registers the shell-only service worker for installability.
 * Does not enable offline chat — API traffic is never cached by sw.js.
 */
export function PwaRegister(): null {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }
    if (!('serviceWorker' in navigator)) {
      return;
    }
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  return null;
}
