'use client';

import { useEffect } from 'react';

// Pages cached right after sign-in so they open offline even if never visited.
const WARM_ROUTES = [
  '/dashboard',
  '/bookings',
  '/bookings/new',
  '/cars',
  '/customers',
  '/customer-ledger',
  '/drivers',
  '/car-issue-return',
  '/income-expenses',
  '/reminders',
  '/reports',
  '/documents',
  '/settings',
  '/staff',
  '/billing',
  '/backup-security',
  '/login',
];

// Change this number whenever WARM_ROUTES changes: it forces one fresh warm-up.
const WARM_VERSION = 2;
const WARM_KEY = `rac_sw_warmed_v${WARM_VERSION}`;
const WARM_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Registers /sw.js (production only) and keeps offline reloads working.
 * Renders nothing.
 */
export default function ServiceWorkerRegister() {
  // 1. Chrome's HARD reload (Ctrl+Shift+R, Ctrl+F5, Shift+F5) deliberately skips the service
  //    worker, so offline it shows ERR_INTERNET_DISCONNECTED. While offline, turn those keys
  //    into a normal reload, which the service worker can answer.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (navigator.onLine) return;
      const key = String(event.key || '').toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const hardReload =
        (ctrl && event.shiftKey && key === 'r') ||
        (ctrl && key === 'f5') ||
        (event.shiftKey && key === 'f5');
      if (hardReload) {
        event.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // 2. Register the service worker and pre-cache the app pages.
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return undefined;

    let cancelled = false;
    let timer = null;
    let registration = null;

    const warmIfNeeded = async () => {
      if (cancelled || !navigator.onLine) return;
      if (!localStorage.getItem('rac_auth')) return; // only after sign-in
      const last = Number(localStorage.getItem(WARM_KEY)) || 0;
      if (Date.now() - last < WARM_EVERY_MS) return;

      const ready = await navigator.serviceWorker.ready;
      if (!ready.active) return;
      localStorage.setItem(WARM_KEY, String(Date.now()));
      ready.active.postMessage({
        type: 'WARM',
        urls: [window.location.pathname + window.location.search, ...WARM_ROUTES],
      });
    };

    const start = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });

        // A new worker version activates silently; IndexedDB is never touched by updates.
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        await warmIfNeeded();
        // The user usually signs in AFTER the first page load, so check again from time to time.
        timer = setInterval(warmIfNeeded, 15000);
      } catch (error) {
        console.warn('Service worker registration failed:', error);
      }
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('load', start);
    };
  }, []);

  return null;
}