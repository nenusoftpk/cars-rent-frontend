// PATH: src/app/income-expenses/page.jsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Info,
  Receipt,
  ListChecks,
  TrendingUp,
  Wallet,
  HandCoins,
  Printer,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import StatCard from '@/components/common/StatCard';
import Tabs from '@/components/common/Tabs';
import StatusBadge from '@/components/common/StatusBadge';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import DateRangeFilter from '@/components/filters/DateRangeFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ExportButtons from '@/components/tables/ExportButtons';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import CarSelector from '@/components/forms/CarSelector';
import ExpenseModal from '@/features/expenses/ExpenseModal';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  categoryLabel,
  methodLabel,
} from '@/features/expenses/expenseConstants';
import {
  useGetExpensesQuery,
  useGetExpenseStatsQuery,
  useDeleteExpenseMutation,
  expenseApi,
} from '@/redux/api/expenseApi';
import {
  useGetPaymentsQuery,
  useGetPaymentStatsQuery,
  paymentApi,
} from '@/redux/api/paymentApi';
import { errorMessage } from '@/redux/api/baseApi';
import { idOf as refId } from '@/redux/api/bookingApi';
import { mapCar } from '@/redux/api/carApi';
import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { useAuth } from '@/hooks/useAuth';
import { formatPKR } from '@/lib/money';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { printHtml, receiptDoc } from '@/lib/printTemplates';

const DEFAULTS = { tab: 'expenses', sort: 'expenseDate:desc' };
const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map(({ value, label }) => ({ value, label }));

// Only these count as "Rent Received" (income). Deposits / refunds are excluded.
const INCOME_TYPES = ['Advance', 'Partial', 'Full'];

const pick = (o, keys, d) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k];
  return d;
};
const money = (v) => (v === undefined || v === null ? '—' : formatPKR(v));

function carInfo(e) {
  const c =
    e.carId && typeof e.carId === 'object'
      ? e.carId
      : e.car && typeof e.car === 'object'
        ? e.car
        : null;
  if (!c) return null;
  const m = mapCar(c);
  return { name: m.name, plate: m.plate, image: m.image };
}

export default function IncomeExpensesPage() {
  const { params, setParams, reset, hasFilters, apiParams } = useListParams(DEFAULTS);
  const { can } = useAuth();
  const tab = params.tab === 'income' ? 'income' : 'expenses';

  // ---------- Expenses ----------
  const expenses = useGetExpensesQuery(apiParams, { skip: tab !== 'expenses' });
  const exportExpenses = useExportAll(expenseApi.endpoints.getExpenses, apiParams);
  const stats = useGetExpenseStatsQuery({
    from: params.from,
    to: params.to,
    carId: params.carId,
  });

  // ---------- Income (rent payments only) ----------
  // Payments are not linked to a single car, so income tab ignores car filter.
  const incomeParams = {
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    from: params.from,
    to: params.to,
    status: 'completed',
  };
  const payments = useGetPaymentsQuery(incomeParams, { skip: tab !== 'income' });
  const exportPayments = useExportAll(paymentApi.endpoints.getPayments, incomeParams);
  const income = useGetPaymentStatsQuery(
    { from: params.from, to: params.to },
    { skip: !!params.carId }
  );

  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [remove, { isLoading: deleting }] = useDeleteExpenseMutation();

  const es = stats.data || {};
  const totalExpense = pick(es, ['totalExpenses', 'totalExpense', 'totalAmount', 'total', 'amount'], undefined);
  const recordCount = pick(es, ['count', 'totalCount', 'totalRecords', 'expenseCount'], expenses.data?.total);
  const totalIncome = params.carId ? undefined : income.data?.received;
  const profit =
    totalIncome !== undefined && totalExpense !== undefined
      ? totalIncome - totalExpense
      : undefined;

  // Only rental-type receipts in the Income tab
  const incomeRows = {
    ...payments.data,
    items: (payments.data?.items || []).filter((p) => INCOME_TYPES.includes(p.type)),
  };

  // ---------- Expense columns ----------
  const expenseCols = [
    { key: 'n', header: '#', render: (r, i) => String(i).padStart(2, '0') },
    {
      key: 'expenseDate',
      header: 'Date',
      sortable: true,
      render: (r) => <span className="whitespace-nowrap">{fmtDate(r.expenseDate)}</span>,
    },
    {
      key: 'category',
      header: 'Type',
      render: (r) => <span className="badge badge-danger">{categoryLabel(r.category)}</span>,
    },
    {
      key: 'title',
      header: 'Details',
      render: (r) => (
        <div className="max-w-[260px]">
          <p className="text-sm font-semibold leading-tight">{r.title}</p>
          {r.description && <p className="text-xs text-muted truncate">{r.description}</p>}
        </div>
      ),
    },
    {
      key: 'carId',
      header: 'Car',
      render: (r) => {
        const c = carInfo(r);
        if (c)
          return (
            <span className="text-xs leading-tight">
              <b>{c.name}</b>
              {c.plate && (
                <>
                  <br />
                  {c.plate}
                </>
              )}
            </span>
          );
        return refId(r.carId) ? <span className="text-xs">Linked car</span> : <span className="text-muted">-</span>;
      },
    },
    {
      key: 'paidTo',
      header: 'Paid To',
      render: (r) => (r.paidTo ? <span className="text-xs">{r.paidTo}</span> : <span className="text-muted">-</span>),
    },
    {
      key: 'paymentMethod',
      header: 'Payment Method',
      render: (r) => methodLabel(r.paymentMethod),
    },
    {
      key: 'amount',
      header: 'Amount (Rs.)',
      sortable: true,
      align: 'right',
      render: (r) => <b className="text-danger">{formatPKR(r.amount)}</b>,
    },
    {
      key: 'a',
      header: 'Action',
      render: (r) => (
        <TableActions
          actions={[
            {
              label: 'View Booking',
              icon: Eye,
              onClick: () => window.open(`/bookings/${refId(r.bookingId)}`, '_self'),
              hidden: !refId(r.bookingId),
            },
            {
              label: 'Edit',
              icon: Pencil,
              onClick: () => setForm(r),
              hidden: !can('expenses:edit'),
            },
            {
              label: 'Delete',
              icon: Trash2,
              danger: true,
              onClick: () => setDel(r),
              hidden: !can('expenses:delete'),
            },
          ]}
        />
      ),
    },
  ];

  // ---------- Income columns ----------
  const incomeCols = [
    { key: 'n', header: '#', render: (r, i) => String(i).padStart(2, '0') },
    {
      key: 'date',
      header: 'Date',
      render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.date)}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <StatusBadge status={r.type} tone="success" />,
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (r) => <span className="text-sm font-semibold">{r.customerName || '-'}</span>,
    },
    {
      key: 'bookingNumber',
      header: 'Booking',
      render: (r) =>
        r.bookingId ? (
          <Link href={`/bookings/${r.bookingId}`} className="text-primary font-semibold">
            {r.bookingNumber || 'View'}
          </Link>
        ) : (
          '-'
        ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (r) => r.method || '-',
    },
    {
      key: 'receivedByName',
      header: 'Received By',
      render: (r) => <span className="text-xs">{r.receivedByName || '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount (Rs.)',
      align: 'right',
      render: (r) => <b className="text-success">{formatPKR(r.amount)}</b>,
    },
    {
      key: 'a',
      header: 'Action',
      render: (r) => (
        <TableActions
          actions={[
            {
              label: 'Print Receipt',
              icon: Printer,
              onClick: () => printHtml(receiptDoc(r), r.receiptNo),
              hidden: !can('billing:print'),
            },
            {
              label: 'View Booking',
              icon: Eye,
              onClick: () => window.open(`/bookings/${r.bookingId}`, '_self'),
              hidden: !r.bookingId,
            },
          ]}
        />
      ),
    },
  ];

  const expenseExportCols = [
    { header: 'Date', value: (r) => fmtDate(r.expenseDate) },
    { header: 'Type', value: (r) => categoryLabel(r.category) },
    { header: 'Details', value: (r) => r.title },
    {
      header: 'Car',
      value: (r) => {
        const c = carInfo(r);
        return c ? `${c.name} ${c.plate}`.trim() : '';
      },
    },
    { header: 'Paid To', value: (r) => r.paidTo },
    { header: 'Payment Method', value: (r) => methodLabel(r.paymentMethod) },
    { header: 'Amount', value: (r) => r.amount, right: true },
  ];

  const incomeExportCols = [
    { header: 'Date', value: (r) => fmtDateTime(r.date) },
    { header: 'Type', value: (r) => r.type },
    { header: 'Customer', value: (r) => r.customerName },
    { header: 'Booking', value: (r) => r.bookingNumber },
    { header: 'Method', value: (r) => r.method },
    { header: 'Amount', value: (r) => r.amount, right: true },
  ];

  const confirmDelete = async () => {
    try {
      await remove(del.id).unwrap();
      toast.success('Expense deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setDel(null);
  };

  const switchTab = (t) => {
    setParams({ tab: t, page: 1 }, { keepPage: true });
  };

  return (
    <PermissionGuard perm="financial.view" page>
      <PageHeader
        title="Income & Expenses"
        subtitle="See money coming in (rent) and money going out (expenses), then your profit for the selected dates."
        actions={
          <PermissionGuard perm="expenses.create">
            <button className="btn btn-primary" onClick={() => setForm({})}>
              <Plus size={18} />
              Add Expense
            </button>
          </PermissionGuard>
        }
      />
      <PageContainer>
        {/* Summary cards – always visible */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Receipt}
            tone="red"
            label="Total Expenses"
            value={money(totalExpense)}
            loading={stats.isLoading}
            hint="For the selected filters"
          />
          <StatCard
            icon={ListChecks}
            tone="blue"
            label="Expense Records"
            value={recordCount}
            loading={stats.isLoading && expenses.isLoading}
          />
          {!params.carId && (
            <>
              <StatCard
                icon={Wallet}
                tone="green"
                label="Rent Received"
                value={money(totalIncome)}
                loading={income.isLoading}
                hint="Without security deposits"
              />
              <StatCard
                icon={TrendingUp}
                tone={profit !== undefined && profit < 0 ? 'red' : 'green'}
                label="Profit"
                value={money(profit)}
                loading={income.isLoading || stats.isLoading}
                hint="Rent received − expenses"
              />
            </>
          )}
          {params.carId && (
            <StatCard
              icon={Info}
              tone="sky"
              label="Income hidden"
              value="—"
              hint="Clear the car filter to see rent received & profit"
            />
          )}
        </div>

        {/* How the numbers work */}
        <p className="flex gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-muted">
          <Info size={15} className="shrink-0 text-primary mt-0.5" />
          <span>
            <b>Rent Received</b> = money customers paid for bookings (advance, partial, full).
            Security deposits are <b>not</b> income.
            <br />
            <b>Profit</b> = Rent Received − Total Expenses.
            When you filter by a car, only that car’s expenses are shown (income is business-wide, so it is hidden).
          </span>
        </p>

        {/* Tabs: Expenses | Income */}
        <div className="card px-3 pt-2">
          <Tabs
            value={tab}
            onChange={switchTab}
            tabs={[
              { value: 'expenses', label: 'Expenses' },
              { value: 'income', label: 'Income (Rent)' },
            ]}
          />
        </div>

        {/* Filters */}
        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchInput
              value={params.search || ''}
              onChange={(v) => setParams({ search: v })}
              placeholder={
                tab === 'expenses'
                  ? 'Details, paid to or notes…'
                  : 'Customer, booking or receipt…'
              }
            />
          </div>
          <DateRangeFilter
            from={params.from || ''}
            to={params.to || ''}
            onChange={(p) => setParams(p)}
          />
          {tab === 'expenses' && (
            <>
              <CarSelector
                label="Car"
                value={params.carId || ''}
                onChange={(v) => setParams({ carId: v })}
                placeholder="All Cars"
              />
              <SelectFilter
                label="Expense Type"
                value={params.category || ''}
                onChange={(v) => setParams({ category: v })}
                options={CATEGORY_OPTIONS}
                allLabel="All Types"
              />
              <SelectFilter
                label="Payment Method"
                value={params.paymentMethod || ''}
                onChange={(v) => setParams({ paymentMethod: v })}
                options={EXPENSE_METHODS}
                allLabel="All Methods"
              />
            </>
          )}
        </FilterPanel>

        {/* Table */}
        {tab === 'expenses' ? (
          <SectionCard
            title="Expense Records"
            actions={
              <ExportButtons
                module="expenses"
                columns={expenseExportCols}
                loadRows={exportExpenses}
                title="Expenses"
                subtitle={`${params.from ? fmtDate(params.from) : 'Start'} to ${params.to ? fmtDate(params.to) : 'today'}`}
                filename="expenses"
              />
            }
          >
            <DataTable
              columns={expenseCols}
              data={expenses.data}
              isLoading={expenses.isLoading}
              isFetching={expenses.isFetching}
              error={expenses.error}
              onRetry={expenses.refetch}
              sort={params.sort}
              onSort={(v) => setParams({ sort: v })}
              onPage={(p) => setParams({ page: p }, { keepPage: true })}
              onPageSize={(n) => setParams({ pageSize: n })}
              hasFilters={hasFilters}
              onReset={reset}
              noun="expenses"
              emptyTitle="No expenses yet"
              emptyMessage="Expenses you add will show here. Use Add Expense to record one."
            />
          </SectionCard>
        ) : (
          <SectionCard
            title="Rent Received (Income)"
            actions={
              <ExportButtons
                module="payments"
                columns={incomeExportCols}
                loadRows={exportPayments}
                title="Rent Received"
                subtitle={`${params.from ? fmtDate(params.from) : 'Start'} to ${params.to ? fmtDate(params.to) : 'today'}`}
                filename="rent-received"
              />
            }
          >
            <p className="mb-3 flex gap-2 rounded-xl bg-success/5 border border-success/20 px-3 py-2 text-xs text-muted">
              <HandCoins size={15} className="shrink-0 text-success" />
              Only Advance, Partial and Full payments are listed. Security deposits and refunds are
              managed under Billing & Payments.
            </p>
            <DataTable
              columns={incomeCols}
              data={incomeRows}
              isLoading={payments.isLoading}
              isFetching={payments.isFetching}
              error={payments.error}
              onRetry={payments.refetch}
              onPage={(p) => setParams({ page: p }, { keepPage: true })}
              onPageSize={(n) => setParams({ pageSize: n })}
              hasFilters={hasFilters}
              onReset={reset}
              noun="payments"
              emptyTitle="No rent received yet"
              emptyMessage="When customers pay for bookings, those receipts appear here."
            />
          </SectionCard>
        )}
      </PageContainer>

      <ExpenseModal open={!!form} expense={form} onClose={() => setForm(null)} />
      <ConfirmDialog
        open={!!del}
        danger
        title="Delete this expense?"
        message={`${del?.title} - ${formatPKR(del?.amount)} will be removed from the records.`}
        confirmLabel="Delete Expense"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDel(null)}
      />
    </PermissionGuard>
  );
}