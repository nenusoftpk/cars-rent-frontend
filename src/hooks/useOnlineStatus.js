'use client';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setOnline, setSyncStatus } from '@/redux/slices/syncSlice';

// Watches the browser connection and plays the pending -> syncing -> synced cycle (simulated in demo mode).
export function useSyncManager() {
  const dispatch = useDispatch(); const { online, pending, status } = useSelector((s) => s.sync);
  useEffect(() => {
    const on = () => dispatch(setOnline(true)); const off = () => dispatch(setOnline(false));
    dispatch(setOnline(navigator.onLine));
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [dispatch]);
  useEffect(() => {
    if (!online || !pending || status !== 'pending') return undefined;
    const t1 = setTimeout(() => dispatch(setSyncStatus('syncing')), 1200);
    const t2 = setTimeout(() => dispatch(setSyncStatus('synced')), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [online, pending, status, dispatch]);
}
