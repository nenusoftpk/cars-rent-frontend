'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Wrench, CalendarPlus, Lock, FileText } from 'lucide-react';
import DetailDrawer from '@/components/modals/DetailDrawer';
import Tabs from '@/components/common/Tabs';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage from '@/components/common/SmartImage';
import NetworkError from '@/components/feedback/NetworkError';
import ServiceRecordModal from './ServiceRecordModal';
import { useGetCarQuery } from '@/redux/api/carApi';
import { useAuth } from '@/hooks/useAuth';
import { formatPKR, formatNum } from '@/lib/money';
import { fmtDate } from '@/lib/dates';
import { toDay } from '@/lib/dates';

const Row = ({ k, v }) => <div className="flex justify-between gap-3 py-2 border-b border-line/70 text-sm"><span className="text-muted">{k}</span><span className="font-semibold text-right">{v || '-'}</span></div>;
const Expiry = ({ label, d }) => { const late = d && d < toDay(); return <Row k={label} v={d ? <span className={late ? 'text-danger' : ''}>{fmtDate(d)}{late && ' (expired)'}</span> : ''} />; };

export default function CarDrawer({ id, onClose, onEdit }) {
  const [tab, setTab] = useState('overview'); const [svc, setSvc] = useState(false); const { can } = useAuth();
  const { data: c, isLoading, error, refetch } = useGetCarQuery(id, { skip: !id });
  const bookings = c?.bookings || []; const expenses = c?.expenses || [];
  return (
    <>
      <DetailDrawer open={!!id} onClose={() => { setTab('overview'); onClose(); }} title="Car Details" width="max-w-2xl"
        footer={c && <>{can('cars:edit') && <button className="btn btn-neutral" onClick={() => onEdit(c)}><Pencil size={16} />Edit Car</button>}
          {can('cars:edit') && can('financial:view') && <button className="btn btn-outline" onClick={() => setSvc(true)}><Wrench size={16} />Add Service Record</button>}
          {can('bookings:create') && c.status !== 'Under Repair' && <Link href={`/bookings/new?carId=${c.id}`} className="btn btn-primary ml-auto"><CalendarPlus size={16} />Book This Car</Link>}</>}>
        {isLoading ? <div className="space-y-3"><div className="skeleton h-48" /><div className="skeleton h-40" /></div> : error ? <NetworkError error={error} onRetry={refetch} /> : c && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-soft border border-line p-3 flex items-center gap-4"><SmartImage src={c.image} alt={c.name} width={220} height={130} className="w-44 h-auto" />
              <div><div className="flex items-center gap-2 flex-wrap"><h3 className="text-xl font-extrabold">{c.name}</h3><StatusBadge status={c.status} /></div><p className="text-muted text-sm">{c.plate} · {c.year} · {c.color}</p><p className="text-lg font-extrabold text-primary mt-1">{formatPKR(c.dailyRate)} <span className="text-sm text-muted font-medium">/ day</span></p>{c.hourlyRate > 0 && <p className="text-sm text-muted">{formatPKR(c.hourlyRate)} / hour</p>}</div></div>
            <Tabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'history', label: 'Rental History', count: bookings.length }, { value: 'maintenance', label: 'Maintenance & Costs' }, { value: 'documents', label: 'Documents' }]} />
            {tab === 'overview' && <div className="grid sm:grid-cols-2 gap-x-8"><div><Row k="Brand" v={c.brand} /><Row k="Model" v={c.model} /><Row k="Model year" v={c.year} /><Row k="Number plate" v={c.plate} /><Row k="Colour" v={c.color} /></div><div><Row k="Fuel" v={c.fuel} /><Row k="Transmission" v={c.transmission} /><Row k="Seats" v={c.seats} /><Row k="Meter reading" v={`${formatNum(c.odometer)} km`} /><Row k="Rent per hour" v={c.hourlyRate ? formatPKR(c.hourlyRate) : ''} /></div></div>}
            {tab === 'history' && (bookings.length ? <ul className="divide-y divide-line">{bookings.slice(0, 30).map((b) => <li key={b.id}><Link href={`/bookings/${b.id}`} className="flex items-center gap-3 py-2.5 hover:bg-soft rounded-lg px-1"><div className="flex-1 min-w-0"><p className="text-sm font-semibold">{b.customerName} <span className="text-muted font-normal">· {b.number}</span></p><p className="text-xs text-muted">{fmtDate(b.pickupAt)} - {fmtDate(b.returnAt)}</p></div><div className="text-right"><p className="text-sm font-semibold">{formatPKR(b.total)}</p><StatusBadge status={b.displayStatus} /></div></Link></li>)}</ul> : <p className="text-center text-sm text-muted py-8">This car has not been rented yet.</p>)}
            {tab === 'maintenance' && (c.financialLocked ? <div className="text-center py-8 text-sm text-muted"><Lock className="mx-auto mb-2" />Service costs are visible to the owner only.</div> : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border border-line p-2.5"><p className="text-xs text-muted">Total Income</p><p className="font-bold text-success">{formatPKR(c.totalIncome)}</p></div><div className="rounded-xl border border-line p-2.5"><p className="text-xs text-muted">Total Expenses</p><p className="font-bold text-danger">{formatPKR(c.totalExpenses)}</p></div><div className="rounded-xl border border-line p-2.5"><p className="text-xs text-muted">Profit</p><p className="font-bold">{formatPKR((c.totalIncome || 0) - (c.totalExpenses || 0))}</p></div></div>
                <Row k="Next service" v={fmtDate(c.nextServiceDate)} /><Row k="Next oil change" v={fmtDate(c.nextOilChangeDate)} />
                {expenses.length ? <ul className="divide-y divide-line max-h-72 overflow-auto">{expenses.map((e) => <li key={e.id} className="flex items-center gap-3 py-2"><StatusBadge status={e.category} /><div className="flex-1 min-w-0"><p className="text-sm truncate">{e.details}</p><p className="text-xs text-muted">{fmtDate(e.date)} · {e.supplier}</p></div><b className="text-danger">{formatPKR(e.amount)}</b></li>)}</ul> : <p className="text-center text-sm text-muted py-6">No service or repair records yet.</p>}
              </div>))}
            {tab === 'documents' && <div className="grid sm:grid-cols-2 gap-3"><div className="space-y-1"><Expiry label="Insurance expiry" d={c.insuranceExpiry} /><Expiry label="Token tax expiry" d={c.tokenExpiry} /><Expiry label="Registration expiry" d={c.registrationExpiry} /></div>
              <div className="grid grid-cols-2 gap-2">{[['Registration', c.registrationDoc], ['Insurance', c.insuranceDoc]].map(([l, u]) => <div key={l} className="rounded-xl border border-line overflow-hidden"><div className="aspect-[16/10] bg-soft grid place-items-center">{u ? <SmartImage src={u} alt={l} width={240} height={150} className="size-full object-cover" /> : <FileText className="text-muted" />}</div><p className="text-xs font-semibold px-2 py-1.5">{l}</p></div>)}</div></div>}
          </div>
        )}
      </DetailDrawer>
      <ServiceRecordModal open={svc} car={c} onClose={() => setSvc(false)} />
    </>
  );
}