'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { Suspense } from 'react';

import AppSidebar from '@/components/layout/AppSidebar';
import AppNavbar from '@/components/layout/AppNavbar';
import ErrorBoundary from '@/components/feedback/ErrorBoundary';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useAuth } from '@/hooks/useAuth';

export default function PlatformLayout({ children }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { ready, token, user, isSuperAdmin, isPlatformEnabled } = useAuth();
  const collapsed = useSelector((s) => s.ui.collapsed);

  // Redirect rules
  useEffect(() => {
    if (!ready) return;

    // Not logged in
    if (!token || !user) {
      router.replace('/login');
      return;
    }

    // Not a super-admin
    if (!isSuperAdmin) {
      router.replace('/dashboard');
      return;
    }

    // Super-admin UI still disabled
    if (!isPlatformEnabled) {
      router.replace('/login');
    }
  }, [ready, token, user, isSuperAdmin, isPlatformEnabled, router]);

  if (!ready || !token || !user || !isSuperAdmin || !isPlatformEnabled) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen">
      <AppSidebar />

      <div
        className={`transition-[padding] duration-200 ${
          collapsed
            ? 'lg:pl-[var(--sidebar-w-collapsed)]'
            : 'lg:pl-[var(--sidebar-w)]'
        }`}
      >
        <AppNavbar />

        <main id="main" className="min-w-0">
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen inline />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}