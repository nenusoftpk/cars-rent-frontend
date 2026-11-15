'use client';
import { useDispatch } from 'react-redux';
import { Menu } from 'lucide-react';
import { setMobileNav, toggleCollapsed } from '@/redux/slices/uiSlice';
import NotificationDropdown from './NotificationDropdown';
import UserProfileDropdown from './UserProfileDropdown';
import SyncStatus from './SyncStatus';
import GlobalSearch from './GlobalSearch';

export default function AppNavbar() {
  const dispatch = useDispatch();
  const toggle = () => (window.matchMedia('(min-width:1024px)').matches ? dispatch(toggleCollapsed()) : dispatch(setMobileNav(true)));
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-3 sm:px-5 bg-sidebar text-white no-print" style={{ height: 'var(--navbar-h)' }}>
      <button onClick={toggle} className="p-2 rounded-xl hover:bg-white/10" aria-label="Open or close menu"><Menu size={22} /></button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1 sm:gap-3"><SyncStatus /><NotificationDropdown /><UserProfileDropdown /></div>
    </header>
  );
}
