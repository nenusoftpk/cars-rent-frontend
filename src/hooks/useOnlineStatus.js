'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setOnline,
  setPending,
  startSync,
  syncCompleted,
  syncFailed,
} from '@/redux/slices/syncSlice';
import { baseApi } from '@/redux/api/baseApi';
import { runSync, getPendingCount, retryFailedItems, requestPersistentStorage } from '@/offline';
import { asId } from '@/offline/session';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');

// Tags refreshed after local temp IDs were replaced by real server IDs.
const SYNC_TAGS = ['Cars', 'Customers', 'Bookings', 'Drivers', 'Payments', 'Expenses', 'Inspections', 'Dashboard', 'Reports', 'Reminders'];
const RETRY_EVERY_MS = 60000;

/**
 * useSyncManager  (same name/usage as before: AppShell just calls useSyncManager())
 *
 * - tracks online/offline and backend reachability
 * - syncs on startup, on reconnect, when the tab becomes visible again, on a retry timer
 *   while changes are waiting, and manually through the returned syncNow()
 * - never runs two syncs at once (in this tab, or across tabs via Web Locks in the engine)
 * - keeps Redux `pending` equal to the real IndexedDB outbox count
 */
export function useSyncManager() {
  const dispatch = useDispatch();

  const online = useSelector((s) => s.sync.online);
  const pending = useSelector((s) => s.sync.pending);
  const token = useSelector((s) => s.auth?.token);
  const user = useSelector((s) => s.auth?.user);
  const authBusiness = useSelector((s) => s.auth?.businessId);

  const businessId = asId(authBusiness ?? user?.businessId ?? user?.business);
  const isAdmin = user?.role === 'admin';

  const busy = useRef(null);
  const live = useRef({ online, pending });
  live.current = { online, pending };

  const refreshPending = useCallback(async () => {
    if (!businessId) return 0;
    try {
      const count = await getPendingCount(businessId);
      dispatch(setPending(count));
      return count;
    } catch {
      return 0;
    }
  }, [businessId, dispatch]);

  const run = useCallback(
    ({ force = false } = {}) => {
      if (!token || !businessId) return Promise.resolve(null);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        dispatch(setOnline(false));
        return Promise.resolve(null);
      }
      if (busy.current) return busy.current;

      busy.current = (async () => {
        try {
          dispatch(startSync({ total: await getPendingCount(businessId) }));
          const result = await runSync({ baseUrl: API_URL, token, businessId, isAdmin, force });

          if (result?.skipped) {
            await refreshPending(); // another tab is already syncing
            return result;
          }

          dispatch(setOnline(true));
          dispatch(syncCompleted(result));
          if (result.pushed > 0) dispatch(baseApi.util.invalidateTags(SYNC_TAGS));
          return result;
        } catch (error) {
          if (error?.code === 'UNREACHABLE') {
            dispatch(setOnline(false)); // browser says online but the backend is not reachable
            await refreshPending();
          } else {
            dispatch(syncFailed(error));
            await refreshPending();
          }
          return null;
        } finally {
          busy.current = null;
        }
      })();

      return busy.current;
    },
    [token, businessId, isAdmin, dispatch, refreshPending]
  );

  // 1. browser online / offline events
  useEffect(() => {
    const goOnline = () => dispatch(setOnline(true));
    const goOffline = () => dispatch(setOnline(false));

    dispatch(setOnline(navigator.onLine));
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [dispatch]);

  // 2. startup + reconnect: exact pending count, then sync
  useEffect(() => {
    if (!token || !businessId) return undefined;
    requestPersistentStorage();
    refreshPending();
    if (!online) return undefined;

    const timer = setTimeout(() => run(), 800); // let the UI show "online" first
    return () => clearTimeout(timer);
  }, [online, token, businessId, isAdmin, run, refreshPending]);

  // 3. retry timer (only while something is waiting or the backend was unreachable) + tab focus
  useEffect(() => {
    if (!token || !businessId) return undefined;

    const tick = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (live.current.pending > 0 || !live.current.online) run();
    };
    const timer = setInterval(tick, RETRY_EVERY_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [token, businessId, run]);

  return {
    /** Manual "Sync now" (forces a fresh download too). */
    syncNow: () => run({ force: true }),
    /** Re-queue entries that failed/held, then sync. */
    retryFailed: async () => {
      if (businessId) await retryFailedItems(businessId);
      return run({ force: true });
    },
  };
}