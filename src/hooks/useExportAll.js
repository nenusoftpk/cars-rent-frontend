'use client';
import { useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';

// Fetches every row matching the current filters (not just the visible page) for print / PDF / Excel.
export function useExportAll(endpoint, params) {
  const dispatch = useDispatch(); const ref = useRef(params); ref.current = params;
  return useCallback(async () => {
    const p = dispatch(endpoint.initiate({ ...ref.current, page: 1, pageSize: 10000 }, { forceRefetch: true, subscribe: false }));
    try { return await p.unwrap(); } finally { p.unsubscribe?.(); }
  }, [dispatch, endpoint]);
}
