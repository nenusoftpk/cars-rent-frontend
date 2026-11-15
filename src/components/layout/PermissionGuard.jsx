'use client';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import EmptyState from '@/components/common/EmptyState';

// Hides a button/section (default) or blocks a whole page (page=true) when the user lacks a permission.
export default function PermissionGuard({ perm, children, fallback = null, page = false }) {
  const { can, ready } = useAuth();
  if (!ready) return null;
  if (can(perm)) return children;
  if (page) return <div className="card mx-4 sm:mx-6 mt-6"><EmptyState icon={ShieldAlert} title="Permission denied" message="You do not have permission to open this page. Please ask the owner to give you access." /></div>;
  return fallback;
}
