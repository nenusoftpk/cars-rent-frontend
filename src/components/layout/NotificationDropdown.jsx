'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, CalendarClock } from 'lucide-react';
import { useGetNotificationsQuery } from '@/redux/api/systemApi';
import { useAuth } from '@/hooks/useAuth';
import { fmtDateTime } from '@/lib/dates';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false); const ref = useRef(null); const { can } = useAuth();
  const { data } = useGetNotificationsQuery(undefined, { pollingInterval: 60000 });
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-xl text-white hover:bg-white/10" aria-label={`Notifications${data?.count ? `, ${data.count} new` : ''}`} aria-expanded={open}>
        <Bell size={22} />{!!data?.count && <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-5 h-5 px-1 rounded-full bg-danger text-[11px] font-bold">{data.count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[330px] max-w-[92vw] card shadow-pop text-heading anim-pop z-50">
          <div className="px-4 py-3 border-b border-line font-bold">Notifications</div>
          <ul className="max-h-80 overflow-auto">
            {!data?.items?.length && <li className="px-4 py-6 text-center text-sm text-muted">No new alerts. Everything is on time.</li>}
            {data?.items?.map((r) => (
              <li key={r.id}><Link href={r.link || '/reminders'} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-soft border-b border-line/60">
                <span className={`grid place-items-center size-9 rounded-lg shrink-0 ${r.view === 'Overdue' ? 'bg-danger/10 text-danger' : 'bg-warning/15 text-warning'}`}>{r.view === 'Overdue' ? <AlertTriangle size={17} /> : <CalendarClock size={17} />}</span>
                <span className="min-w-0"><span className="block text-sm font-semibold">{r.type}</span><span className="block text-xs text-muted truncate">{r.details}</span><span className="block text-xs text-muted">{fmtDateTime(r.due)}</span></span></Link></li>
            ))}
          </ul>
          {can('reminders:view') && <Link href="/reminders" onClick={() => setOpen(false)} className="block text-center py-3 text-sm font-semibold text-primary">View all reminders</Link>}
        </div>
      )}
    </div>
  );
}
