'use client';

import { useEffect } from 'react';

// Routes pre-cached after login so they open offline even if never visited.
// EDIT THIS LIST to match your real routes. Unknown/404 routes are simply skipped.
const WARM_ROUTES = [
  '/dashboard',
  '/bookings',
  '/bookings/new',
  '/cars',
  '/customers',
  '/drivers',
  '/payments',
  '/expenses',
  '/reports',
  '/settings',
];

const WARM_KEY = 'rac_sw_warmed_at';
const WARM_EVERY_MS = 6 * 60 * 60 * 1000;

/** Registers /sw.js once. Renders nothing. Production builds only. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return undefined;

    let cancelled = false;

    const start = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });

        // A new version activates silently; IndexedDB is not touched by SW updates.
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        const ready = await navigator.serviceWorker.ready;
        if (cancelled || !navigator.onLine) return;

        const signedIn = Boolean(localStorage.getItem('rac_auth'));
        const last = Number(localStorage.getItem(WARM_KEY)) || 0;
        if (!signedIn || Date.now() - last < WARM_EVERY_MS) return;

        localStorage.setItem(WARM_KEY, String(Date.now()));
        ready.active?.postMessage({
          type: 'WARM',
          urls: [window.location.pathname + window.location.search, ...WARM_ROUTES],
        });
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
    };
  }, []);

  return null;
}