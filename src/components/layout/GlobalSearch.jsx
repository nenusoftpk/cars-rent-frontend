'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, Car, CalendarDays } from 'lucide-react';
import { useSearchAllQuery } from '@/redux/api/systemApi';

export default function GlobalSearch() {
  const [q, setQ] = useState(''); const [d, setD] = useState(''); const [open, setOpen] = useState(false); const ref = useRef(null); const router = useRouter();
  useEffect(() => { const t = setTimeout(() => setD(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const { data } = useSearchAllQuery(d, { skip: d.trim().length < 2 });
  const go = (href) => { setOpen(false); setQ(''); router.push(href); };
  const groups = [['Customers', Users, data?.customers, (r) => `/customers?search=${encodeURIComponent(r.title)}`], ['Cars', Car, data?.cars, (r) => `/cars?search=${encodeURIComponent(r.sub)}`], ['Bookings', CalendarDays, data?.bookings, (r) => `/bookings/${r.id}`]];
  const any = groups.some(([, , l]) => l?.length);
  return (
    <div className="relative flex-1 max-w-xl" ref={ref}>
      <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search customer, car, booking or invoice…" aria-label="Search everything"
        className="w-full h-10 rounded-xl bg-white/10 border border-white/10 pl-10 pr-3 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:bg-white/15 focus:ring-2 focus:ring-primary" />
      {open && d.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 card shadow-pop text-heading anim-pop z-50 max-h-96 overflow-auto p-1">
          {!any && <p className="px-4 py-5 text-sm text-center text-muted">No results found</p>}
          {groups.map(([name, Icon, list, href]) => list?.length ? (
            <div key={name}><p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted">{name}</p>
              {list.map((r) => <button key={r.id} onClick={() => go(href(r))} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-soft text-left"><Icon size={15} className="text-primary shrink-0" /><span className="min-w-0"><span className="block text-sm font-medium truncate">{r.title}</span><span className="block text-xs text-muted truncate">{r.sub}</span></span></button>)}</div>
          ) : null)}
        </div>
      )}
    </div>
  );
}
