// PATH: src/app/dashboard/page.jsx   (REPLACE your existing Dashboard page)
'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Car, CarFront, CircleCheck, Wrench, CalendarPlus, AlertTriangle, DollarSign, Clock,
  CalendarDays, UserPlus, CreditCard, Bell, Lock, Shield, FileText, Droplets,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';
import PageBanner from '@/components/layout/PageBanner';
import PageContainer from '@/components/layout/PageContainer';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Avatar } from '@/components/common/SmartImage';
import NetworkError from '@/components/feedback/NetworkError';
import EmptyState from '@/components/common/EmptyState';
import { useGetDashboardQuery } from '@/redux/api/reportApi';
import { useAuth } from '@/hooks/useAuth';
import { formatPKR } from '@/lib/money';
import { fmtShort, fmtTime, fmtDate, toDay } from '@/lib/dates';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const ACT = {
  booking: [CalendarPlus, 'bg-primary/10 text-primary'],
  return: [Car, 'bg-warning/15 text-warning'],
  payment: [CreditCard, 'bg-success/10 text-success'],
  alert: [AlertTriangle, 'bg-danger/10 text-danger'],
  customer: [UserPlus, 'bg-violet-100 text-violet-600'],
};

const REM = {
  'Car Return': Car,
  'Overdue Car': AlertTriangle,
  'Insurance Expiry': Shield,
  'Token Tax Expiry': FileText,
  'Car Document Expiry': FileText,
  'Car Servicing': Wrench,
  'Oil Change': Droplets,
};

// used only when the API does not send carsByStatus
const STATUS_COLORS = {
  Available: '#00b873',
  'On Rent': '#0866f5',
  Booked: '#8b5cf6',
  'Under Repair': '#ff3655',
};

/* ------------------------------------------------------------------ */
/*  Small safe helpers (a bad value must never crash the dashboard)    */
/* ------------------------------------------------------------------ */
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const has = (v) => v !== undefined && v !== null;
const pick = (o, keys, d) => {
  for (const k of keys) if (o && has(o[k])) return o[k];
  return d;
};
// API may send an array OR { items } / { data } – always return an array
const list = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : Array.isArray(v?.data) ? v.data : []);
const safe = (fn, v, fallback = '-') => {
  if (!v) return fallback;
  try { const out = fn(v); return out || fallback; } catch { return fallback; }
};
const idOf = (o, i = 0) => o?.id ?? o?._id ?? `row-${i}`;

const View = ({ href }) => <Link href={href} className="btn btn-neutral btn-sm">View All</Link>;

/* ------------------------------------------------------------------ */
/*  Normalise the dashboard response (tolerates the usual key names)   */
/* ------------------------------------------------------------------ */
function normalise(raw) {
  const d = raw?.data && !Array.isArray(raw.data) && typeof raw.data === 'object' && !raw.stats ? raw.data : raw || {};
  const st = d.stats || d.summary || d;

  const stats = {
    totalCars: num(pick(st, ['totalCars', 'total', 'cars'], 0)),
    available: num(pick(st, ['available', 'availableCars'], 0)),
    onRent: num(pick(st, ['onRent', 'rented', 'onRentCars'], 0)),
    repair: num(pick(st, ['repair', 'underRepair', 'maintenance'], 0)),
    booked: num(pick(st, ['booked', 'reserved'], 0)),
    todayBookings: num(pick(st, ['todayBookings', 'todayNew', 'newBookingsToday'], 0)),
    dueToday: num(pick(st, ['dueToday', 'carsDueToday'], 0)),
    overdue: num(pick(st, ['overdue', 'overdueCars', 'overdueCount'], 0)),
    todayIncome: pick(st, ['todayIncome', 'incomeToday'], null),
    pending: pick(st, ['pending', 'pendingReceivable', 'receivable'], null),
  };

  // car status donut
  let carsByStatus = list(d.carsByStatus || d.carStatus).map((c) => ({
    name: c.name || c.status || c.label || 'Unknown',
    value: num(c.value ?? c.count),
    color: c.color || STATUS_COLORS[c.name || c.status] || '#94a3b8',
  }));
  if (!carsByStatus.length) {
    carsByStatus = [
      { name: 'Available', value: stats.available, color: STATUS_COLORS.Available },
      { name: 'On Rent', value: stats.onRent, color: STATUS_COLORS['On Rent'] },
      ...(stats.booked ? [{ name: 'Booked', value: stats.booked, color: STATUS_COLORS.Booked }] : []),
      { name: 'Under Repair', value: stats.repair, color: STATUS_COLORS['Under Repair'] },
    ];
  }
  const statusSum = carsByStatus.reduce((a, c) => a + c.value, 0);
  if (!stats.totalCars) stats.totalCars = statusSum;

  const monthly = list(d.monthly || d.monthlyIncomeExpenses || d.chart).map((m) => ({
    month: m.month || m.label || '',
    income: num(m.income),
    expenses: num(m.expenses ?? m.expense),
  }));
  const totals = d.totals || {
    income: monthly.reduce((a, m) => a + m.income, 0),
    expenses: monthly.reduce((a, m) => a + m.expenses, 0),
  };

  const activity = list(d.activity || d.todayActivity).map((a, i) => ({
    id: idOf(a, i),
    type: a.type,
    title: a.title || '',
    text: a.text || a.description || '',
    at: a.at || a.createdAt,
  }));

  const mapBooking = (b, i) => ({
    id: idOf(b, i),
    number: b.number || b.bookingNo || b.bookingNumber || '-',
    customerName: b.customerName || b.customer?.name || '-',
    customerPhoto: b.customerPhoto || b.customer?.photo,
    customerMobile: b.customerMobile || b.customer?.mobile || b.customer?.phone || '',
    carName: b.carName || b.car?.name || '-',
    carPlate: b.carPlate || b.car?.plate || b.car?.numberPlate || '',
    carImage: b.carImage || b.car?.image,
    pickupAt: b.pickupAt || b.pickupDate || b.from,
    returnAt: b.returnAt || b.returnDate || b.to,
    displayStatus: b.displayStatus || b.status,
    lateDays: has(b.lateDays)
      ? num(b.lateDays)
      : b.returnAt
        ? Math.max(1, Math.ceil((Date.now() - new Date(b.returnAt).getTime()) / 86400000))
        : 1,
  });

  const reminders = list(d.reminders).map((r, i) => ({
    id: idOf(r, i),
    type: r.type || 'Reminder',
    details: r.details || r.text || '',
    due: r.due || r.dueAt,
    view: r.view,
  }));

  return {
    scope: d.scope,
    financialLocked: d.financialLocked === true,
    stats,
    statusSum,
    carsByStatus,
    monthly,
    totals: { income: num(totals.income), expenses: num(totals.expenses) },
    activity,
    latestBookings: list(d.latestBookings || d.latest).map(mapBooking),
    overdueList: list(d.overdueList || d.overdueBookings).map(mapBooking),
    reminders,
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const { user, can } = useAuth();
  const [clock, setClock] = useState(null);
  const { data: raw, isLoading, error, refetch } = useGetDashboardQuery(undefined, { refetchOnMountOrArgChange: true });

  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const data = useMemo(() => (raw ? normalise(raw) : null), [raw]);
  const s = data?.stats;
  const L = isLoading || (!data && !error);
  const today = toDay();
  const locked = !!data?.financialLocked;
  const firstName = (user?.name || '').trim().split(' ')[0];

  const money = (v) => {
    if (locked) return <span className="inline-flex items-center gap-1 text-base text-muted"><Lock size={14} />Owner only</span>;
    return formatPKR(num(v));
  };

  return (
    <>
      <PageBanner
        title={firstName ? `Welcome Back, ${firstName}!` : 'Welcome Back!'}
        subtitle={data?.scope === 'own' ? 'Here is an overview of your own bookings today.' : 'Here is your Rent a Car business overview for today.'}
        breadcrumb={[]}
        right={clock && (
          <div className="hidden sm:flex items-center gap-3 rounded-xl bg-white text-heading px-4 py-2.5 shadow-card">
            <CalendarDays className="text-primary" />
            <div className="leading-tight">
              <p className="text-xs text-muted">{format(clock, 'EEEE')}</p>
              <p className="text-sm font-bold">{fmtDate(clock.toISOString())}</p>
              <p className="text-xs font-semibold">{format(clock, 'hh:mm a')}</p>
            </div>
          </div>
        )}
      />
      <PageContainer>
        {error ? (
          <div className="card"><NetworkError error={error} onRetry={refetch} /></div>
        ) : (
          <>
            {/* ---------- Fleet cards ---------- */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard loading={L} icon={Car} tone="blue" label="Total Cars" value={s?.totalCars} hint="All cars in system" href="/cars" />
              <StatCard loading={L} icon={CircleCheck} tone="green" label="Available Cars" value={s?.available} hint="Ready for booking" href="/cars?status=Available" />
              <StatCard loading={L} icon={CarFront} tone="orange" label="On Rent" value={s?.onRent} hint="Currently rented" href="/cars?status=On+Rent" />
              <StatCard loading={L} icon={Wrench} tone="red" label="Under Repair" value={s?.repair} hint="Under maintenance" href="/cars?status=Under+Repair" />
            </div>

            {/* ---------- Today cards ---------- */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              <StatCard loading={L} icon={CalendarPlus} tone="sky" label="Today's Bookings" value={s?.todayBookings} hint="New bookings today" href={`/bookings?dateField=createdAt&from=${today}&to=${today}`} />
              <StatCard loading={L} icon={CarFront} tone="purple" label="Cars Due Today" value={s?.dueToday} hint="Cars expected today" href="/bookings?view=active" />
              <StatCard loading={L} icon={AlertTriangle} tone="red" label="Overdue Cars" value={s?.overdue} hint="Returned late" href="/bookings?view=overdue" />
              <StatCard
                loading={L} icon={DollarSign} tone="green" label="Today's Income" value={L ? undefined : money(s?.todayIncome)} hint="Total received today"
                href={can('billing:view') && !locked ? `/billing?tab=payments&from=${today}&to=${today}` : undefined}
              />
              <StatCard
                loading={L} icon={Clock} tone="orange" label="Pending Receivable" value={L ? undefined : money(s?.pending)} hint="Remaining from customers"
                href={can('reports:view') && !locked ? '/reports?report=outstanding' : undefined}
              />
            </div>

            {/* ---------- Charts / activity ---------- */}
            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard title="Car Status Overview">
                {L ? <div className="skeleton h-56" /> : (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative w-48 h-48 mx-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.statusSum > 0 ? data.carsByStatus : [{ name: 'No cars', value: 1, color: '#e2e8f0' }]}
                            dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none"
                          >
                            {(data.statusSum > 0 ? data.carsByStatus : [{ name: 'No cars', color: '#e2e8f0' }]).map((c) => <Cell key={c.name} fill={c.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
                        <div><p className="text-3xl font-extrabold">{s.totalCars}</p><p className="text-xs text-muted">Total Cars</p></div>
                      </div>
                    </div>
                    <ul className="flex-1 min-w-[150px] space-y-2.5 text-sm">
                      {data.carsByStatus.map((c) => (
                        <li key={c.name} className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                          <span className="flex-1">{c.name}</span>
                          <b>{c.value}</b>
                          <span className="text-muted">({s.totalCars > 0 ? Math.round((c.value / s.totalCars) * 100) : 0}%)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Today's Activity">
                {L ? <div className="skeleton h-56" /> : !data.activity.length ? (
                  <EmptyState title="No activity yet" message="New bookings, returns and payments will show here." />
                ) : (
                  <ul className="space-y-3.5">
                    {data.activity.map((a) => {
                      const [Icon, cls] = ACT[a.type] || ACT.booking;
                      return (
                        <li key={a.id} className="flex items-center gap-3">
                          <span className={`grid place-items-center size-10 rounded-full shrink-0 ${cls}`}><Icon size={18} /></span>
                          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{a.title}</p><p className="text-xs text-muted truncate">{a.text}</p></div>
                          <span className="text-xs text-muted shrink-0">{safe(fmtTime, a.at, '')}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Monthly Income vs Expenses" subtitle="Last 6 months">
                {L ? <div className="skeleton h-56" /> : locked ? (
                  <EmptyState icon={Lock} title="Owner only" message="Business income and expenses are shown to the owner." />
                ) : !data.monthly.length ? (
                  <EmptyState title="No data yet" message="Income and expenses will appear once payments and expenses are recorded." />
                ) : (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.monthly} barGap={4}>
                          <CartesianGrid vertical={false} stroke="#e8eef8" />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                          <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}K`} width={42} />
                          <Tooltip formatter={(v) => formatPKR(v)} cursor={{ fill: '#f1f5fb' }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="income" name="Income" fill="#00b873" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expenses" name="Expenses" fill="#ff3655" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="rounded-xl border border-line p-2.5"><p className="text-xs text-muted">Total Income</p><p className="font-bold text-success">{formatPKR(data.totals.income)}</p></div>
                      <div className="rounded-xl border border-line p-2.5"><p className="text-xs text-muted">Total Expenses</p><p className="font-bold text-danger">{formatPKR(data.totals.expenses)}</p></div>
                    </div>
                  </>
                )}
              </SectionCard>
            </div>

            {/* ---------- Lists ---------- */}
            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard title="Latest Bookings" actions={<View href="/bookings" />} className="xl:col-span-1" bodyClassName="!px-3">
                {L ? <div className="skeleton h-48" /> : !data.latestBookings.length ? (
                  <EmptyState title="No bookings yet" message="Create your first booking to see it here." action={<Link href="/bookings/new" className="btn btn-primary">New Booking</Link>} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-clean min-w-[420px]">
                      <thead><tr><th>#</th><th>Customer</th><th>Car</th><th>From - To</th><th>Status</th></tr></thead>
                      <tbody>
                        {data.latestBookings.map((b) => (
                          <tr key={b.id}>
                            <td><Link href={`/bookings/${b.id}`} className="text-primary font-semibold">{b.number}</Link></td>
                            <td><div className="flex items-center gap-2"><Avatar src={b.customerPhoto} name={b.customerName} size={24} /><span className="truncate max-w-[90px]">{b.customerName}</span></div></td>
                            <td className="whitespace-nowrap">{b.carName}</td>
                            <td className="whitespace-nowrap text-xs">{safe(fmtShort, b.pickupAt)} - {safe(fmtShort, b.returnAt)}</td>
                            <td><StatusBadge status={b.displayStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Overdue Cars" actions={<View href="/bookings?view=overdue" />} bodyClassName="!px-3">
                {L ? <div className="skeleton h-48" /> : !data.overdueList.length ? (
                  <EmptyState icon={CircleCheck} title="No overdue cars" message="All rented cars are on time." />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.overdueList.map((b) => (
                      <li key={b.id}>
                        <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 py-2.5 px-1 hover:bg-soft rounded-lg">
                          <Avatar src={b.carImage} name={b.carName} size={44} className="!rounded-lg" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{b.carName} <span className="text-muted font-normal">{b.carPlate}</span></p>
                            <p className="text-xs text-muted truncate">{b.customerName}{b.customerMobile ? ` · ${b.customerMobile}` : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs">{safe(fmtDate, b.returnAt)}</p>
                            <span className="badge badge-danger">{b.lateDays} {b.lateDays === 1 ? 'Day' : 'Days'} late</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Upcoming Reminders" actions={can('reminders:view') && <View href="/reminders" />} bodyClassName="!px-3">
                {L ? <div className="skeleton h-48" /> : !data.reminders.length ? (
                  <EmptyState icon={Bell} title="No reminders" message="Nothing due soon." />
                ) : (
                  <ul className="divide-y divide-line">
                    {data.reminders.map((r) => {
                      const Icon = REM[r.type] || Bell;
                      return (
                        <li key={r.id} className="flex items-center gap-3 py-2.5 px-1">
                          <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0"><Icon size={17} /></span>
                          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{r.type}</p><p className="text-xs text-muted truncate">{r.details}</p></div>
                          <span className={`text-xs font-semibold shrink-0 ${r.view === 'Today' ? 'text-danger' : 'text-muted'}`}>
                            {r.view === 'Today' ? `Today, ${safe(fmtTime, r.due, '')}` : safe(fmtDate, r.due)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            </div>
          </>
        )}
      </PageContainer>
    </>
  );
}