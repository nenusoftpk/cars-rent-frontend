'use client';

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setOnline, setSyncStatus } from '@/redux/slices/syncSlice';
import { runSync, getPendingCount } from '@/offline';

/**
 * useSyncManager
 *
 * - Detects online / offline
 * - When the browser comes back online → runs the real sync engine
 * - Updates Redux syncSlice (status + pending count)
 */
export function useSyncManager() {
  const dispatch = useDispatch();
  const { online, status } = useSelector((s) => s.sync);

  // Get auth data needed for sync
  const token = useSelector((s) => s.auth?.token);
  const businessId = useSelector((s) => s.auth?.user?.businessId);

  // Prevent multiple simultaneous syncs
  const isSyncingRef = useRef(false);

  // --------------------------------------------------
  // 1. Listen to browser online / offline events
  // --------------------------------------------------
  useEffect(() => {
    const goOnline = () => dispatch(setOnline(true));
    const goOffline = () => dispatch(setOnline(false));

    // Set initial status
    dispatch(setOnline(navigator.onLine));

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [dispatch]);

  // --------------------------------------------------
  // 2. Real sync when we become online
  // --------------------------------------------------
  useEffect(() => {
    // Only run when we just became online and we have credentials
    if (!online || !token || !businessId) return;

    // Avoid running multiple syncs at the same time
    if (isSyncingRef.current) return;

    const doSync = async () => {
      try {
        isSyncingRef.current = true;
        dispatch(setSyncStatus('syncing'));

        const result = await runSync({
          baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
          token,
          businessId,
          dispatch,
        });

        // Update pending count after sync
        const pending = await getPendingCount(businessId);

        // You can also dispatch a custom action if you later add setPending to syncSlice
        // dispatch(setPending(pending));

        dispatch(setSyncStatus(pending > 0 ? 'pending' : 'synced'));
      } catch (err) {
        console.error('Offline sync failed:', err);
        dispatch(setSyncStatus('failed'));
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Small delay so the UI can show "online" first
    const timer = setTimeout(doSync, 800);

    return () => clearTimeout(timer);
  }, [online, token, businessId, dispatch]);

  // --------------------------------------------------
  // Optional: also expose a manual sync function
  // --------------------------------------------------
  // You can return it if you want buttons like "Sync Now"
  // return { syncNow: () => { ... } };
}