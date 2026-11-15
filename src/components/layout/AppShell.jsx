'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import AppSidebar from './AppSidebar';
import AppNavbar from './AppNavbar';
import ErrorBoundary from '@/components/feedback/ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { useSyncManager } from '@/hooks/useOnlineStatus';
import { useGetMeQuery } from '@/redux/api/authApi';
import { useGetSettingsQuery } from '@/redux/api/settingApi';
import { setUser } from '@/redux/slices/authSlice';
import { setFormatPrefs } from '@/lib/dates';
import { setBusinessInfo } from '@/lib/printTemplates';
import { LoadingScreen } from './LoadingScreen';

export default function AppShell({ children }) {
  const { token, ready, user } = useAuth(); const router = useRouter(); const path = usePathname(); const dispatch = useDispatch();
  const collapsed = useSelector((s) => s.ui.collapsed);
  useSyncManager();
  useEffect(() => { if (ready && !token) router.replace('/login'); }, [ready, token, router]);
  const { data: me } = useGetMeQuery(undefined, { skip: !token });
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !token });
  useEffect(() => { if (me && JSON.stringify(me) !== JSON.stringify(user)) dispatch(setUser(me)); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (settings) { setFormatPrefs(settings); setBusinessInfo(settings); } }, [settings]);
  if (!ready || !token || !user) return <LoadingScreen />;
  return (
    <div className="min-h-screen">
      <AppSidebar />
      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[var(--sidebar-w-collapsed)]' : 'lg:pl-[var(--sidebar-w)]'}`}>
        <AppNavbar />
        <main id="main" className="min-w-0"><ErrorBoundary key={path}><Suspense fallback={<LoadingScreen inline />}>{children}</Suspense></ErrorBoundary></main>
      </div>
    </div>
  );
}
