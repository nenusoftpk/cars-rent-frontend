// PATH: src/app/dashboard/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Car,
  CarFront,
  CircleCheck,
  Wrench,
  CalendarPlus,
  AlertTriangle,
  DollarSign,
  Clock,
  CalendarDays,
  UserPlus,
  CreditCard,
  Bell,
  Lock,
  Shield,
  FileText,
  Droplets,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subDays,
  eachMonthOfInterval,
} from 'date-fns';

import PageBanner from '@/components/layout/PageBanner';
import PageContainer from '@/components/layout/PageContainer';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Avatar } from '@/components/common/SmartImage';
import NetworkError from '@/components/feedback/NetworkError';
import EmptyState from '@/components/common/EmptyState';
import DateRangeFilter from '@/components/filters/DateRangeFilter';

import { useGetDashboardQuery } from '@/redux/api/reportApi';
import { useGetCarStatsQuery } from '@/redux/api/carApi';
import { useGetBookingsQuery } from '@/redux/api/bookingApi';
import { useGetPaymentStatsQuery, useGetPaymentsQuery } from '@/redux/api/paymentApi';
import { useGetExpenseStatsQuery, useGetExpensesQuery } from '@/redux/api/expenseApi';
import { useGetCustomersQuery } from '@/redux/api/customerApi';
import { useGetRemindersQuery } from '@/redux/api/systemApi';
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
  expense: [FileText, 'bg-danger/10 text-danger'],
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

const STATUS_COLORS = {
  Available: '#00b873',
  'On Rent': '#0866f5',
  Booked: '#8b5cf6',
  'Under Repair': '#ff3655',
  'Out of Service': '#64748b',
};

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const has = (v) => v !== undefined && v !== null;
const pick = (o, keys, d) => {
  for (const k of keys) if (o && has(o[k])) return o[k];
  return d;
};
const list = (v) =>
  Array.isArray(v)
    ? v
    : Array.isArray(v?.items)
      ? v.items
      : Array.isArray(v?.data)
        ? v.data
        : Array.isArray(v?.data?.items)
          ? v.data.items
          : [];
const safe = (fn, v, fallback = '-') => {
  if (!v) return fallback;
  try {
    const out = fn(v);
    return out || fallback;
  } catch {
    return fallback;
  }
};
const idOf = (o, i = 0) => o?.id ?? o?._id ?? `row-${i}`;
const unwrap = (r) =>
  r && typeof r === 'object' && r.data && !Array.isArray(r.data) && r.items === undefined
    ? r.data
    : r || {};

const View = ({ href }) => (
  <Link href={href} className="btn btn-neutral btn-sm">
    View All
  </Link>
);

/** Build from/to ISO strings for the selected period (local calendar). */
function rangeForPeriod(period, customFrom, customTo) {
  const now = new Date();

  if (period === 'custom') {
    const from = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now);
    const to = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      labelFrom: format(from, 'yyyy-MM-dd'),
      labelTo: format(to, 'yyyy-MM-dd'),
    };
  }

  let from;
  let to;

  switch (period) {
    case 'this_week':
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'this_month':
      from = startOfMonth(now);
      to = endOfMonth(now);
      break;
    case 'last_month': {
      const prev = subMonths(now, 1);
      from = startOfMonth(prev);
      to = endOfMonth(prev);
      break;
    }
    case 'this_year':
      from = startOfYear(now);
      to = endOfYear(now);
      break;
    case 'today':
    default:
      from = startOfDay(now);
      to = endOfDay(now);
      break;
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    labelFrom: format(from, 'yyyy-MM-dd'),
    labelTo: format(to, 'yyyy-MM-dd'),
  };
}

/** Last 6 calendar months for the income vs expenses chart. */
function lastSixMonths() {
  const end = endOfMonth(new Date());
  const start = startOfMonth(subMonths(end, 5));
  return eachMonthOfInterval({ start, end }).map((d) => ({
    key: format(d, 'yyyy-MM'),
    month: format(d, 'MMM'),
    from: startOfMonth(d).toISOString(),
    to: endOfMonth(d).toISOString(),
    labelFrom: format(startOfMonth(d), 'yyyy-MM-dd'),
    labelTo: format(endOfMonth(d), 'yyyy-MM-dd'),
  }));
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const { user, can } = useAuth();
  const [clock, setClock] = useState(null);
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const range = useMemo(
    () => rangeForPeriod(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const dateParams = useMemo(
    () => ({ from: range.labelFrom, to: range.labelTo }),
    [range.labelFrom, range.labelTo]
  );

  const isoParams = useMemo(
    () => ({ from: range.from, to: range.to }),
    [range.from, range.to]
  );

  /* ---------- Core dashboard (overview + period financials) ---------- */
  const {
    data: dashRaw,
    isLoading: dashLoading,
    error: dashError,
    refetch: refetchDash,
  } = useGetDashboardQuery(isoParams, { refetchOnMountOrArgChange: true });

  const dash = useMemo(() => unwrap(dashRaw), [dashRaw]);

  /* ---------- Fleet counts (ALWAYS current – from car stats) ---------- */
  const {
    data: carStatsRaw,
    isLoading: carStatsLoading,
  } = useGetCarStatsQuery(undefined, { refetchOnMountOrArgChange: true });
  const carStats = useMemo(() => unwrap(carStatsRaw), [carStatsRaw]);

  /* ---------- Bookings in period + latest + overdue ---------- */
  const {
    data: periodBookingsRaw,
    isLoading: periodBookingsLoading,
  } = useGetBookingsQuery(
    { ...dateParams, pageSize: 50, page: 1 },
    { refetchOnMountOrArgChange: true }
  );
  const periodBookings = useMemo(() => list(unwrap(periodBookingsRaw)), [periodBookingsRaw]);

  const {
    data: latestRaw,
    isLoading: latestLoading,
  } = useGetBookingsQuery(
    { pageSize: 8, page: 1, sort: 'createdAt:desc' },
    { refetchOnMountOrArgChange: true }
  );
  const latestBookings = useMemo(() => list(unwrap(latestRaw)).slice(0, 8), [latestRaw]);

  const {
    data: overdueRaw,
    isLoading: overdueLoading,
  } = useGetBookingsQuery(
    { view: 'overdue', pageSize: 10, page: 1 },
    { refetchOnMountOrArgChange: true }
  );
  // Fallback: active rentals past return date
  const {
    data: activeRaw,
  } = useGetBookingsQuery(
    { view: 'active', pageSize: 50, page: 1 },
    { refetchOnMountOrArgChange: true }
  );
  const overdueList = useMemo(() => {
    const fromView = list(unwrap(overdueRaw));
    if (fromView.length) return fromView;
    const now = Date.now();
    return list(unwrap(activeRaw)).filter((b) => {
      const ret = b.returnAt || b.returnDate;
      if (!ret) return false;
      const t = new Date(ret).getTime();
      return Number.isFinite(t) && t < now;
    });
  }, [overdueRaw, activeRaw]);

  /* ---------- Payments (income in period) + recent activity ---------- */
  const {
    data: payStatsRaw,
    isLoading: payStatsLoading,
  } = useGetPaymentStatsQuery(dateParams, { refetchOnMountOrArgChange: true });
  const payStats = useMemo(() => unwrap(payStatsRaw), [payStatsRaw]);

  const {
    data: recentPaymentsRaw,
  } = useGetPaymentsQuery(
    { ...dateParams, status: 'completed', pageSize: 15, page: 1 },
    { refetchOnMountOrArgChange: true }
  );
  const recentPayments = useMemo(() => list(unwrap(recentPaymentsRaw)), [recentPaymentsRaw]);

  /* ---------- Expenses in period ---------- */
  const {
    data: expStatsRaw,
    isLoading: expStatsLoading,
  } = useGetExpenseStatsQuery(dateParams, { refetchOnMountOrArgChange: true });
  const expStats = useMemo(() => unwrap(expStatsRaw), [expStatsRaw]);

  const {
    data: recentExpensesRaw,
  } = useGetExpensesQuery(
    { ...dateParams, pageSize: 10, page: 1 },
    { refetchOnMountOrArgChange: true }
  );
  const recentExpenses = useMemo(() => list(unwrap(recentExpensesRaw)), [recentExpensesRaw]);

  /* ---------- Pending receivable from customers ---------- */
  const {
    data: customersRaw,
    isLoading: customersLoading,
  } = useGetCustomersQuery(
    { pageSize: 1, page: 1 },
    { refetchOnMountOrArgChange: true }
  );
  const customersSummary = useMemo(() => {
    const d = unwrap(customersRaw);
    return d?.summary || d || {};
  }, [customersRaw]);

  /* ---------- Reminders ---------- */
  const {
    data: remindersRaw,
    isLoading: remindersLoading,
  } = useGetRemindersQuery(
    { view: 'Today', pageSize: 8, page: 1 },
    { refetchOnMountOrArgChange: true }
  );
  const reminders = useMemo(() => list(unwrap(remindersRaw)).slice(0, 8), [remindersRaw]);

  /* ---------- Monthly income vs expenses (last 6 months) ---------- */
  // Build from period payment/expense stats when available; otherwise empty months.
  // We cannot fire 12 parallel hooks safely in a loop, so we synthesise a simple
  // chart from current period totals split across the last months when the
  // backend does not expose a monthly series. Prefer real series if dashboard
  // ever returns one.
  const monthlySeries = useMemo(() => {
    const fromDash = list(dash?.monthly || dash?.monthlyIncomeExpenses || dash?.chart);
    if (fromDash.length) {
      return fromDash.map((m) => ({
        month: m.month || m.label || '',
        income: num(m.income),
        expenses: num(m.expenses ?? m.expense),
      }));
    }
    // Lightweight fallback: show last 6 months with zeros except current period bucket
    const months = lastSixMonths();
    const incomeTotal = num(
      pick(payStats, ['received', 'rentalReceived', 'netRentalReceived', 'cashReceived'], null) ??
        pick(dash?.financials, ['cashReceived', 'netCash'], 0)
    );
    const expenseTotal = num(
      pick(expStats, ['totalAmount', 'totalExpenses', 'total', 'amount'], null) ??
        pick(dash?.financials, ['expenses'], 0)
    );
    const currentKey = format(new Date(), 'yyyy-MM');
    return months.map((m) => ({
      month: m.month,
      income: m.key === currentKey ? incomeTotal : 0,
      expenses: m.key === currentKey ? expenseTotal : 0,
    }));
  }, [dash, payStats, expStats]);

  const monthlyTotals = useMemo(
    () => ({
      income: monthlySeries.reduce((a, m) => a + num(m.income), 0),
      expenses: monthlySeries.reduce((a, m) => a + num(m.expenses), 0),
    }),
    [monthlySeries]
  );

  /* ---------- Derived fleet stats (prefer car stats – always current) ---------- */
  const fleet = useMemo(() => {
    const totalCars = num(
      pick(carStats, ['totalCars', 'total'], null) ??
        pick(dash?.overview, ['totalCars', 'total'], 0)
    );
    const available = num(
      pick(carStats, ['availableCars', 'available'], null) ??
        pick(dash?.overview, ['availableCars', 'available'], 0)
    );
    const onRent = num(
      pick(carStats, ['onRentCars', 'on_rent', 'onRent'], null) ??
        pick(dash?.overview, ['activeRentals', 'onRent'], null) ??
        pick(dash?.bookings, ['onRent'], 0)
    );
    const booked = num(pick(carStats, ['bookedCars', 'booked'], null) ?? pick(dash?.bookings, ['reserved'], 0));
    const repair = num(
      pick(carStats, ['underRepairCars', 'maintenance', 'repair', 'underRepair'], null) ??
        pick(dash?.overview, ['underRepair', 'repair'], 0)
    );
    const outOfService = num(pick(carStats, ['out_of_service', 'outOfService'], 0));

    return { totalCars, available, onRent, booked, repair, outOfService };
  }, [carStats, dash]);

  /* ---------- Period-scoped metrics ---------- */
  const periodMetrics = useMemo(() => {
    const todayBookings = num(
      pick(dash?.bookings, ['inSelectedPeriod'], null) ?? periodBookings.length
    );

    // Cars due in period: active/reserved with return date inside range
    const dueToday = periodBookings.filter((b) => {
      const status = String(b.displayStatus || b.status || '').toLowerCase();
      if (status.includes('cancel') || status.includes('completed')) return false;
      const ret = b.returnAt || b.returnDate;
      if (!ret) return false;
      const t = new Date(ret).getTime();
      const from = new Date(range.from).getTime();
      const to = new Date(range.to).getTime();
      return Number.isFinite(t) && t >= from && t <= to;
    }).length;

    const overdue = overdueList.length;

    // Income: prefer payment stats (rent only), then dashboard financials
    const todayIncome =
      pick(payStats, ['received', 'rentalReceived', 'netRentalReceived'], null) ??
      pick(dash?.financials, ['cashReceived', 'netCash', 'todayIncome'], 0);

    // Pending receivable: customer summary amount, else count * not available
    const pending =
      pick(customersSummary, ['pendingAmount', 'pending'], null) ??
      pick(dash?.financials, ['pendingReceivable', 'receivable'], 0);

    return {
      todayBookings,
      dueToday,
      overdue,
      todayIncome: num(todayIncome),
      pending: num(pending),
    };
  }, [dash, periodBookings, overdueList, payStats, customersSummary, range]);

  /* ---------- Car status donut ---------- */
  const carsByStatus = useMemo(() => {
    const rows = [
      { name: 'Available', value: fleet.available, color: STATUS_COLORS.Available },
      { name: 'On Rent', value: fleet.onRent, color: STATUS_COLORS['On Rent'] },
      ...(fleet.booked
        ? [{ name: 'Booked', value: fleet.booked, color: STATUS_COLORS.Booked }]
        : []),
      { name: 'Under Repair', value: fleet.repair, color: STATUS_COLORS['Under Repair'] },
      ...(fleet.outOfService
        ? [{ name: 'Out of Service', value: fleet.outOfService, color: STATUS_COLORS['Out of Service'] }]
        : []),
    ].filter((c) => c.value > 0 || ['Available', 'On Rent', 'Under Repair'].includes(c.name));
    return rows;
  }, [fleet]);

  const statusSum = carsByStatus.reduce((a, c) => a + c.value, 0);

  /* ---------- Activity feed (bookings + payments + expenses in period) ---------- */
  const activity = useMemo(() => {
    const items = [];

    for (const b of periodBookings.slice(0, 10)) {
      items.push({
        id: `bk-${idOf(b)}`,
        type: 'booking',
        title: b.number || b.bookingNumber || 'Booking',
        text: `${b.customerName || 'Customer'} · ${b.carName || 'Car'}`,
        at: b.createdAt || b.pickupAt || b.pickupDate,
      });
    }

    for (const p of recentPayments.slice(0, 8)) {
      const type = String(p.type || '').toLowerCase();
      if (['security_deposit', 'security_refund', 'deposit', 'deposit_refund'].includes(type)) continue;
      items.push({
        id: `pay-${idOf(p)}`,
        type: 'payment',
        title: `Payment ${formatPKR(p.amount)}`,
        text: `${p.customerName || p.receivedByName || 'Customer'} · ${p.method || ''}`.trim(),
        at: p.date || p.paymentDate || p.createdAt,
      });
    }

    for (const e of recentExpenses.slice(0, 6)) {
      items.push({
        id: `exp-${idOf(e)}`,
        type: 'expense',
        title: e.title || e.details || 'Expense',
        text: `${formatPKR(e.amount)} · ${e.category || e.paymentMethod || ''}`.trim(),
        at: e.expenseDate || e.date || e.createdAt,
      });
    }

    items.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });

    return items.slice(0, 12);
  }, [periodBookings, recentPayments, recentExpenses]);

  /* ---------- Loading / auth ---------- */
  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const L =
    dashLoading ||
    carStatsLoading ||
    (!dash && !dashError && dashLoading);

  const listsLoading = latestLoading || overdueLoading || remindersLoading;
  const moneyLoading = payStatsLoading || expStatsLoading || customersLoading;

  const today = toDay();
  const locked = !!dash?.financialLocked;
  const firstName = (user?.name || '').trim().split(' ')[0];
  const financialScope = dash?.financials?.scope || dash?.scope;

  const money = (v) => {
    if (locked) {
      return (
        <span className="inline-flex items-center gap-1 text-base text-muted">
          <Lock size={14} />
          Owner only
        </span>
      );
    }
    return formatPKR(num(v));
  };

  const periodLabel =
    period === 'custom'
      ? `${range.labelFrom} → ${range.labelTo}`
      : PERIODS.find((p) => p.id === period)?.label || 'Today';

  const mapBookingRow = (b, i) => {
    const returnAt = b.returnAt || b.returnDate;
    let lateDays = num(b.lateDays);
    if (!lateDays && returnAt) {
      const diff = Date.now() - new Date(returnAt).getTime();
      if (diff > 0) lateDays = Math.max(1, Math.ceil(diff / 86400000));
    }
    return {
      id: idOf(b, i),
      number: b.number || b.bookingNumber || b.bookingNo || '-',
      customerName: b.customerName || b.customer?.name || '-',
      customerPhoto: b.customerPhoto || b.customer?.photo,
      customerMobile: b.customerMobile || b.customer?.mobile || b.customer?.phone || '',
      carName: b.carName || b.car?.name || '-',
      carPlate: b.carPlate || b.car?.plate || b.car?.numberPlate || '',
      carImage: b.carImage || b.car?.image,
      pickupAt: b.pickupAt || b.pickupDate || b.from,
      returnAt,
      displayStatus: b.displayStatus || b.status,
      lateDays: lateDays || 1,
    };
  };

  return (
    <>
      <PageBanner
        title={firstName ? `Welcome Back, ${firstName}!` : 'Welcome Back!'}
        subtitle={
          financialScope === 'own' || financialScope === 'assigned_bookings_and_own_expenses'
            ? 'Here is an overview of your own bookings for the selected period.'
            : 'Here is your Rent a Car business overview for the selected period.'
        }
        breadcrumb={[]}
        right={
          clock && (
            <div className="hidden sm:flex items-center gap-3 rounded-xl bg-white text-heading px-4 py-2.5 shadow-card">
              <CalendarDays className="text-primary" />
              <div className="leading-tight">
                <p className="text-xs text-muted">{format(clock, 'EEEE')}</p>
                <p className="text-sm font-bold">{fmtDate(clock.toISOString())}</p>
                <p className="text-xs font-semibold">{format(clock, 'hh:mm a')}</p>
              </div>
            </div>
          )
        }
      />

      <PageContainer>
        {/* ---------- Period filter ---------- */}
        <div className="card p-3 sm:p-4 mb-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    period === p.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-soft text-heading hover:bg-line'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {period === 'custom' && (
              <div className="w-full lg:w-auto min-w-[280px]">
                <DateRangeFilter
                  from={customFrom}
                  to={customTo}
                  onChange={(r) => {
                    setCustomFrom(r.from || '');
                    setCustomTo(r.to || '');
                  }}
                  fromLabel="From"
                  toLabel="To"
                />
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            Showing data for <b>{periodLabel}</b>. Fleet counts (Total / Available / On Rent /
            Under Repair) are always current and do not change with the date filter.
          </p>
        </div>

        {dashError ? (
          <div className="card">
            <NetworkError error={dashError} onRetry={refetchDash} />
          </div>
        ) : (
          <>
            {/* ---------- Fleet cards (always current from car stats) ---------- */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                loading={L || carStatsLoading}
                icon={Car}
                tone="blue"
                label="Total Cars"
                value={fleet.totalCars}
                hint="All cars in system"
                href="/cars"
              />
              <StatCard
                loading={L || carStatsLoading}
                icon={CircleCheck}
                tone="green"
                label="Available Cars"
                value={fleet.available}
                hint="Ready for booking"
                href="/cars?status=Available"
              />
              <StatCard
                loading={L || carStatsLoading}
                icon={CarFront}
                tone="orange"
                label="On Rent"
                value={fleet.onRent}
                hint={
                  fleet.booked
                    ? `${fleet.onRent} out · ${fleet.booked} booked`
                    : 'Currently rented'
                }
                href="/cars?status=On+Rent"
              />
              <StatCard
                loading={L || carStatsLoading}
                icon={Wrench}
                tone="red"
                label="Under Repair"
                value={fleet.repair}
                hint="Under maintenance"
                href="/cars?status=Under+Repair"
              />
            </div>

            {/* ---------- Period cards ---------- */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              <StatCard
                loading={L || periodBookingsLoading}
                icon={CalendarPlus}
                tone="sky"
                label={period === 'today' ? "Today's Bookings" : 'Bookings in Period'}
                value={periodMetrics.todayBookings}
                hint={period === 'today' ? 'New bookings today' : 'Bookings in selected dates'}
                href={
                  period === 'today'
                    ? `/bookings?dateField=createdAt&from=${today}&to=${today}`
                    : `/bookings?dateField=createdAt&from=${range.labelFrom}&to=${range.labelTo}`
                }
              />
              <StatCard
                loading={L || periodBookingsLoading}
                icon={CarFront}
                tone="purple"
                label={period === 'today' ? 'Cars Due Today' : 'Cars Due in Period'}
                value={periodMetrics.dueToday}
                hint="Expected returns"
                href="/bookings?view=active"
              />
              <StatCard
                loading={L || overdueLoading}
                icon={AlertTriangle}
                tone="red"
                label="Overdue Cars"
                value={periodMetrics.overdue}
                hint="Returned late"
                href="/bookings?view=overdue"
              />
              <StatCard
                loading={L || moneyLoading}
                icon={DollarSign}
                tone="green"
                label={period === 'today' ? "Today's Income" : 'Income in Period'}
                value={L || moneyLoading ? undefined : money(periodMetrics.todayIncome)}
                hint="Rental cash received (no deposits)"
                href={
                  can('billing:view') && !locked
                    ? `/billing?tab=payments&from=${range.labelFrom}&to=${range.labelTo}`
                    : undefined
                }
              />
              <StatCard
                loading={L || moneyLoading}
                icon={Clock}
                tone="orange"
                label="Pending Receivable"
                value={L || moneyLoading ? undefined : money(periodMetrics.pending)}
                hint="Remaining from customers"
                href={
                  can('reports:view') && !locked
                    ? '/customers?hasDues=true'
                    : can('customers:view')
                      ? '/customers?hasDues=true'
                      : undefined
                }
              />
            </div>

            {/* ---------- Charts / activity ---------- */}
            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard title="Car Status Overview">
                {L || carStatsLoading ? (
                  <div className="skeleton h-56" />
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative w-48 h-48 mx-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={
                              statusSum > 0
                                ? carsByStatus
                                : [{ name: 'No cars', value: 1, color: '#e2e8f0' }]
                            }
                            dataKey="value"
                            innerRadius={58}
                            outerRadius={84}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {(statusSum > 0
                              ? carsByStatus
                              : [{ name: 'No cars', color: '#e2e8f0' }]
                            ).map((c) => (
                              <Cell key={c.name} fill={c.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
                        <div>
                          <p className="text-3xl font-extrabold">{fleet.totalCars}</p>
                          <p className="text-xs text-muted">Total Cars</p>
                        </div>
                      </div>
                    </div>
                    <ul className="flex-1 min-w-[150px] space-y-2.5 text-sm">
                      {carsByStatus.map((c) => (
                        <li key={c.name} className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: c.color }}
                          />
                          <span className="flex-1">{c.name}</span>
                          <b>{c.value}</b>
                          <span className="text-muted">
                            (
                            {fleet.totalCars > 0
                              ? Math.round((c.value / fleet.totalCars) * 100)
                              : 0}
                            %)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Activity in Period">
                {L || periodBookingsLoading ? (
                  <div className="skeleton h-56" />
                ) : !activity.length ? (
                  <EmptyState
                    title="No activity yet"
                    message="New bookings, returns and payments will show here for the selected dates."
                  />
                ) : (
                  <ul className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                    {activity.map((a) => {
                      const [Icon, cls] = ACT[a.type] || ACT.booking;
                      return (
                        <li key={a.id} className="flex items-center gap-3">
                          <span
                            className={`grid place-items-center size-10 rounded-full shrink-0 ${cls}`}
                          >
                            <Icon size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{a.title}</p>
                            <p className="text-xs text-muted truncate">{a.text}</p>
                          </div>
                          <span className="text-xs text-muted shrink-0">
                            {safe(fmtTime, a.at, '')}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="Monthly Income vs Expenses" subtitle="Last 6 months">
                {L || moneyLoading ? (
                  <div className="skeleton h-56" />
                ) : locked ? (
                  <EmptyState
                    icon={Lock}
                    title="Owner only"
                    message="Business income and expenses are shown to the owner."
                  />
                ) : !monthlySeries.some((m) => m.income || m.expenses) ? (
                  <EmptyState
                    title="No data yet"
                    message="Income and expenses will appear once payments and expenses are recorded."
                  />
                ) : (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlySeries} barGap={4}>
                          <CartesianGrid vertical={false} stroke="#e8eef8" />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            fontSize={11}
                            tickFormatter={(v) => `${Math.round(v / 1000)}K`}
                            width={42}
                          />
                          <Tooltip formatter={(v) => formatPKR(v)} cursor={{ fill: '#f1f5fb' }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="income" name="Income" fill="#00b873" radius={[4, 4, 0, 0]} />
                          <Bar
                            dataKey="expenses"
                            name="Expenses"
                            fill="#ff3655"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="rounded-xl border border-line p-2.5">
                        <p className="text-xs text-muted">Total Income</p>
                        <p className="font-bold text-success">{formatPKR(monthlyTotals.income)}</p>
                      </div>
                      <div className="rounded-xl border border-line p-2.5">
                        <p className="text-xs text-muted">Total Expenses</p>
                        <p className="font-bold text-danger">{formatPKR(monthlyTotals.expenses)}</p>
                      </div>
                    </div>
                  </>
                )}
              </SectionCard>
            </div>

            {/* ---------- Lists ---------- */}
            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard
                title="Latest Bookings"
                actions={<View href="/bookings" />}
                className="xl:col-span-1"
                bodyClassName="!px-3"
              >
                {listsLoading ? (
                  <div className="skeleton h-48" />
                ) : !latestBookings.length ? (
                  <EmptyState
                    title="No bookings yet"
                    message="Create your first booking to see it here."
                    action={
                      <Link href="/bookings/new" className="btn btn-primary">
                        New Booking
                      </Link>
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-clean min-w-[420px]">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Customer</th>
                          <th>Car</th>
                          <th>From - To</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestBookings.map((raw, i) => {
                          const b = mapBookingRow(raw, i);
                          return (
                            <tr key={b.id}>
                              <td>
                                <Link
                                  href={`/bookings/${b.id}`}
                                  className="text-primary font-semibold"
                                >
                                  {b.number}
                                </Link>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    src={b.customerPhoto}
                                    name={b.customerName}
                                    size={24}
                                  />
                                  <span className="truncate max-w-[90px]">
                                    {b.customerName}
                                  </span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap">{b.carName}</td>
                              <td className="whitespace-nowrap text-xs">
                                {safe(fmtShort, b.pickupAt)} - {safe(fmtShort, b.returnAt)}
                              </td>
                              <td>
                                <StatusBadge status={b.displayStatus} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Overdue Cars"
                actions={<View href="/bookings?view=overdue" />}
                bodyClassName="!px-3"
              >
                {listsLoading ? (
                  <div className="skeleton h-48" />
                ) : !overdueList.length ? (
                  <EmptyState
                    icon={CircleCheck}
                    title="No overdue cars"
                    message="All rented cars are on time."
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {overdueList.map((raw, i) => {
                      const b = mapBookingRow(raw, i);
                      return (
                        <li key={b.id}>
                          <Link
                            href={`/bookings/${b.id}`}
                            className="flex items-center gap-3 py-2.5 px-1 hover:bg-soft rounded-lg"
                          >
                            <Avatar
                              src={b.carImage}
                              name={b.carName}
                              size={44}
                              className="!rounded-lg"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">
                                {b.carName}{' '}
                                <span className="text-muted font-normal">{b.carPlate}</span>
                              </p>
                              <p className="text-xs text-muted truncate">
                                {b.customerName}
                                {b.customerMobile ? ` · ${b.customerMobile}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs">{safe(fmtDate, b.returnAt)}</p>
                              <span className="badge badge-danger">
                                {b.lateDays} {b.lateDays === 1 ? 'Day' : 'Days'} late
                              </span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>

              <SectionCard
                title="Upcoming Reminders"
                actions={can('reminders:view') && <View href="/reminders" />}
                bodyClassName="!px-3"
              >
                {listsLoading || remindersLoading ? (
                  <div className="skeleton h-48" />
                ) : !reminders.length ? (
                  <EmptyState icon={Bell} title="No reminders" message="Nothing due soon." />
                ) : (
                  <ul className="divide-y divide-line">
                    {reminders.map((r, i) => {
                      const Icon = REM[r.type] || Bell;
                      return (
                        <li key={idOf(r, i)} className="flex items-center gap-3 py-2.5 px-1">
                          <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
                            <Icon size={17} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{r.type}</p>
                            <p className="text-xs text-muted truncate">
                              {r.details || r.message || r.text || ''}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold shrink-0 ${
                              r.view === 'Today' || r.view === 'Overdue'
                                ? 'text-danger'
                                : 'text-muted'
                            }`}
                          >
                            {r.view === 'Today'
                              ? `Today, ${safe(fmtTime, r.due || r.dueDate, '')}`
                              : safe(fmtDate, r.due || r.dueDate)}
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
