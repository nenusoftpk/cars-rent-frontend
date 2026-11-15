'use client';
import { useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Keeps filters / search / page / sort in the URL so a refresh (or a shared link) keeps them.
export function useListParams(defaults = {}) {
  const sp = useSearchParams(); const router = useRouter(); const pathname = usePathname();
  const spString = sp.toString();
  const params = useMemo(() => {
    const o = { ...defaults }; new URLSearchParams(spString).forEach((v, k) => { o[k] = v; });
    o.page = Number(o.page || 1); o.pageSize = Number(o.pageSize || 10); return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spString]);
  const setParams = useCallback((patch, { keepPage = false } = {}) => {
    const next = new URLSearchParams(spString);
    Object.entries(patch).forEach(([k, v]) => { if (v === '' || v == null || String(v) === String(defaults[k] ?? '__none__')) next.delete(k); else next.set(k, String(v)); });
    if (!keepPage && !('page' in patch)) next.delete('page');
    const q = next.toString(); router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spString, pathname, router]);
  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);
  const hasFilters = useMemo(() => [...new URLSearchParams(spString).keys()].some((k) => !['page', 'pageSize', 'sort', 'view', 'tab'].includes(k)), [spString]);
  return { params, setParams, reset, hasFilters, apiParams: params };
}
