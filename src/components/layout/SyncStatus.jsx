'use client';
import { useSelector } from 'react-redux';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertOctagon, GitMerge, Clock } from 'lucide-react';
import { SYNC_STATES } from '@/constants';
import { cn } from '@/lib/utils';
import { fmtTime } from '@/lib/dates';

const ICON = { online: Cloud, offline: CloudOff, pending: Clock, syncing: RefreshCw, synced: CheckCircle2, failed: AlertOctagon, conflict: GitMerge };
const TONE = { success: 'text-emerald-300', neutral: 'text-slate-300', warning: 'text-amber-300', info: 'text-sky-300', danger: 'text-rose-300' };
// Shows the 7 offline/sync states. In demo mode the sync is simulated - no data leaves this browser.
export default function SyncStatus() {
  const { status, pending, online, lastSyncAt } = useSelector((s) => s.sync);
  const key = !online ? 'offline' : status; const st = SYNC_STATES[key] || SYNC_STATES.online; const Icon = ICON[key] || Cloud;
  return (
    <div className={cn('hidden md:flex items-center gap-1.5 text-xs font-medium px-2', TONE[st.tone])} role="status" title={`Demo mode: simulated sync status.${lastSyncAt ? ` Last synced ${fmtTime(lastSyncAt)}` : ''}`}>
      <Icon size={16} className={key === 'syncing' ? 'animate-spin' : ''} />{st.label}{pending > 0 && key !== 'synced' && <span className="rounded-full bg-white/15 px-1.5">{pending}</span>}
    </div>
  );
}
