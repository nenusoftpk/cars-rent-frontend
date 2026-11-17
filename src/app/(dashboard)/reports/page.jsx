// PATH: src/app/reports/page.jsx
'use client';

import { useMemo } from 'react';
import {
  FileBarChart,
  TrendingUp,
  CalendarDays,
  CreditCard,
  Receipt,
  Users,
  Car,
  UserCheck,
} from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import StatusFilter from '@/components/filters/StatusFilter';
import DateRangeFilter from '@/components/filters/DateRangeFilter';
import DataTable from '@/components/tables/DataTable';
import ExportButtons from '@/components/tables/ExportButtons';
import CarSelector from '@/components/forms/CarSelector';
import CustomerSelector from '@/components/forms/CustomerSelector';
import NetworkError from '@/components/feedback/NetworkError';
import EmptyState from '@/components/common/EmptyState';

import { REPORTS, FLAT, totalsRow } from '@/features/reports/reportConfig';
import { useGetReportQuery, reportApi } from '@/redux/api/reportApi';
import { useGetDriversQuery } from '@/redux/api/driverApi';
import { useGetStaffOptionsQuery } from '@/redux/api/staffApi';

import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { useAuth } from '@/hooks/useAuth';
import { formatPKR } from '@/lib/money';
import { cn } from '@/lib/utils';

const REPORT_ICONS = {
  'income-expense': TrendingUp,
  bookings: CalendarDays,
  payments: CreditCard,
  expenses: Receipt,
  customers: Users,
  'cars-status': Car,
  drivers: UserCheck,
};

export default function ReportsPage() {
  const { can } = useAuth();

  const {
    params,
    setParams,
    reset,
    hasFilters,
  } = useListParams({ report: 'cars-status' });

  // Only show money reports when user has financial permission
  const allowed = useMemo(
    () => FLAT.filter((r) => !r.money || can('financial:view') || can('reports.view')),
    [can]
  );

  const cfg = allowed.find((r) => r.id === params.report) || allowed[0];

  // Build clean query args for the backend
  const queryArgs = useMemo(() => {
    const args = {
      name: cfg?.id,
      ...Object.fromEntries(
        Object.entries(params).filter(
          ([key]) => key !== 'report' && key !== 'page' && key !== 'pageSize'
        )
      ),
    };

    // Keep pagination
    if (params.page) args.page = params.page;
    if (params.pageSize) args.pageSize = params.pageSize || params.limit;

    return args;
  }, [cfg?.id, params]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetReportQuery(queryArgs, {
    skip: !cfg?.id,
    refetchOnMountOrArgChange: true,
  });

  const exportAll = useExportAll(reportApi.endpoints.getReport, queryArgs);

  // Lazy-load filter options
  const { data: driversData } = useGetDriversQuery(
    { pageSize: 100 },
    { skip: !cfg?.filters?.includes('driver') }
  );

  const { data: staffData } = useGetStaffOptionsQuery(undefined, {
    skip: !cfg?.filters?.includes('staff'),
  });

  const hasFilter = (key) => cfg?.filters?.includes(key);

  const drivers = Array.isArray(driversData?.items)
    ? driversData.items
    : Array.isArray(driversData)
      ? driversData
      : [];

  const staffOptions = Array.isArray(staffData)
    ? staffData
    : Array.isArray(staffData?.items)
      ? staffData.items
      : Array.isArray(staffData?.data)
        ? staffData.data
        : [];

  // ---------- Columns ----------
  const columns = useMemo(() => {
    return (cfg?.cols || []).map((col) => ({
      key: col.key,
      header: col.header,
      sortable: col.sortable,
      align: col.align,
      render: (row) => {
        if (col.kind === 'status') {
          return <StatusBadge status={row[col.key]} />;
        }

        // Support nested keys (customer.name, car.numberPlate, etc.)
        const value = col.key.includes('.')
          ? col.key.split('.').reduce((acc, k) => acc?.[k], row)
          : row[col.key];

        if (col.fmt) return col.fmt(value);
        if (value == null || value === '') return '—';
        return value;
      },
    }));
  }, [cfg]);

  // Export columns (plain text)
  const exportColumns = useMemo(() => {
    return (cfg?.cols || []).map((col) => ({
      header: col.header,
      value: (row) => {
        const value = col.key.includes('.')
          ? col.key.split('.').reduce((acc, k) => acc?.[k], row)
          : row[col.key];
        return col.fmt ? col.fmt(value) : value ?? '';
      },
      right: col.align === 'right',
    }));
  }, [cfg]);

  // Footer totals
  const footer = useMemo(() => {
    const totals = data?.totals || data?.summary;
    if (!totals || Object.keys(totals).length === 0) return null;

    return (
      <tr className="bg-soft font-semibold">
        {(cfg?.cols || []).map((col, index) => (
          <td
            key={col.key}
            className={cn(
              'px-3 py-3 border-t border-line',
              col.align === 'right' && 'text-right'
            )}
          >
            {index === 0
              ? 'Total'
              : totals[col.key] != null
                ? col.fmt
                  ? col.fmt(totals[col.key])
                  : totals[col.key]
                : ''}
          </td>
        ))}
      </tr>
    );
  }, [data, cfg]);

  // Special handling for Income & Expense (mostly summary)
  const isSummaryOnly =
    cfg?.id === 'income-expense' ||
    (data?.items?.length === 0 && data?.summary);

  const chooseReport = (id) => {
    reset();
    // small delay so reset finishes cleanly
    setTimeout(() => setParams({ report: id }), 0);
  };

  return (
    <PermissionGuard perm="reports.view" page>
      <PageHeader
        title="Reports"
        subtitle="Simple reports you can print or save as PDF and Excel."
      />

      <PageContainer>
        <div className="grid gap-4 lg:grid-cols-[240px_1fr] items-start">
          {/* ========== LEFT NAV ========== */}
          <nav
            aria-label="Reports"
            className="card p-2 lg:sticky lg:top-20 overflow-hidden"
          >
            {/* Mobile: horizontal scroll chips */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {allowed.map((item) => {
                const Icon = REPORT_ICONS[item.id] || FileBarChart;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseReport(item.id)}
                    className={cn(
                      'flex items-center gap-2 shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition',
                      cfg?.id === item.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-soft text-heading hover:bg-line'
                    )}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop: vertical groups */}
            <div className="hidden lg:block">
              {REPORTS.map((group) => {
                const items = group.items.filter((item) =>
                  allowed.some((a) => a.id === item.id)
                );
                if (!items.length) return null;

                return (
                  <div key={group.group} className="mb-2">
                    <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                      {group.group}
                    </p>
                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const Icon = REPORT_ICONS[item.id] || FileBarChart;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => chooseReport(item.id)}
                            aria-current={cfg?.id === item.id ? 'page' : undefined}
                            className={cn(
                              'w-full flex items-center gap-2.5 text-left rounded-lg px-3 py-2.5 text-sm font-medium transition',
                              cfg?.id === item.id
                                ? 'bg-primary text-white'
                                : 'hover:bg-soft text-heading'
                            )}
                          >
                            <Icon size={16} className="shrink-0 opacity-80" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {!can('financial:view') && (
                <p className="text-xs text-muted p-3 leading-relaxed">
                  Money reports (Income, Payments, Expenses) are available to the owner.
                </p>
              )}
            </div>
          </nav>

          {/* ========== MAIN CONTENT ========== */}
          <div className="space-y-4 min-w-0">
            {/* Filters */}
            <FilterPanel
              onReset={reset}
              cols="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
              {/* Search */}
              <div className="min-w-0">
                <label className="label">Search</label>
                <SearchInput
                  value={params.search || ''}
                  onChange={(value) => setParams({ search: value })}
                  placeholder="Search this report…"
                />
              </div>

              {/* Date range */}
              {hasFilter('date') && (
                <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                  <DateRangeFilter
                    from={params.from || ''}
                    to={params.to || ''}
                    onChange={(range) => {
                      // Keep both values stable
                      setParams({
                        from: range.from ?? params.from ?? '',
                        to: range.to ?? params.to ?? '',
                      });
                    }}
                    fromLabel={`From (${cfg?.dateLabel || 'date'})`}
                    toLabel={`To (${cfg?.dateLabel || 'date'})`}
                  />
                </div>
              )}

              {/* Car */}
              {hasFilter('car') && (
                <CarSelector
                  label="Car"
                  value={params.carId || ''}
                  onChange={(value) => setParams({ carId: value })}
                  placeholder="All Cars"
                />
              )}

              {/* Customer */}
              {hasFilter('customer') && (
                <CustomerSelector
                  label="Customer"
                  value={params.customerId || ''}
                  onChange={(value) => setParams({ customerId: value })}
                  placeholder="All Customers"
                  params={{ status: '' }}
                />
              )}

              {/* Status */}
              {hasFilter('status') && (
                <StatusFilter
                  label="Status"
                  value={params.status || ''}
                  onChange={(value) => setParams({ status: value })}
                  options={cfg?.statuses || []}
                />
              )}

              {/* Driver */}
              {hasFilter('driver') && (
                <SelectFilter
                  label="Driver"
                  value={params.driverId || ''}
                  onChange={(value) => setParams({ driverId: value })}
                  options={drivers.map((d) => ({
                    value: d.id || d._id,
                    label: d.name,
                  }))}
                  allLabel="All Drivers"
                />
              )}

              {/* Staff / Employee */}
              {hasFilter('staff') && (
                <SelectFilter
                  label="Employee"
                  value={params.staffId || ''}
                  onChange={(value) => setParams({ staffId: value })}
                  options={staffOptions.map((s) => ({
                    value: s.id || s._id,
                    label: s.name,
                  }))}
                  allLabel="All Employees"
                />
              )}
            </FilterPanel>

            {/* Report Card */}
            <SectionCard
              title={cfg?.label || 'Report'}
              subtitle={
                cfg?.dateLabel
                  ? `Dates are based on ${cfg.dateLabel.toLowerCase()}.`
                  : undefined
              }
              actions={
                <ExportButtons
                  module="reports"
                  columns={exportColumns}
                  loadRows={exportAll}
                  title={cfg?.label}
                  subtitle={
                    params.from
                      ? `${params.from} → ${params.to || 'today'}`
                      : 'All time'
                  }
                  filename={cfg?.id || 'report'}
                  totals={(rows) =>
                    totalsRow(cfg, rows?.totals ?? data?.totals ?? data?.summary)
                  }
                />
              }
            >
              {/* Special summary cards for Income & Expense */}
              {cfg?.id === 'income-expense' && data?.summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                  <div className="rounded-xl border border-line bg-soft/50 p-4">
                    <p className="text-xs text-muted mb-1">Rental Revenue</p>
                    <p className="text-lg font-bold text-success">
                      {formatPKR(data.summary.earnedRentalRevenue ?? data.totals?.earnedRentalRevenue ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-soft/50 p-4">
                    <p className="text-xs text-muted mb-1">Cash Received</p>
                    <p className="text-lg font-bold text-primary">
                      {formatPKR(data.summary.cashReceived ?? data.totals?.cashReceived ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-soft/50 p-4">
                    <p className="text-xs text-muted mb-1">Total Costs</p>
                    <p className="text-lg font-bold text-danger">
                      {formatPKR(data.summary.totalCosts ?? data.totals?.totalCosts ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-soft/50 p-4">
                    <p className="text-xs text-muted mb-1">Est. Operating Profit</p>
                    <p className="text-lg font-bold">
                      {formatPKR(
                        data.summary.estimatedOperatingProfit ??
                          data.totals?.estimatedOperatingProfit ??
                          0
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Main table */}
              {error ? (
                <NetworkError error={error} onRetry={refetch} />
              ) : isSummaryOnly && !data?.items?.length ? (
                <EmptyState
                  title="Summary loaded"
                  message="This report shows totals and summary only. Use the cards above or export for details."
                />
              ) : (
                <div className="overflow-x-auto -mx-1 px-1">
                  <DataTable
                    columns={columns}
                    data={data}
                    isLoading={isLoading}
                    isFetching={isFetching}
                    error={error}
                    onRetry={refetch}
                    sort={params.sort}
                    onSort={(value) => setParams({ sort: value })}
                    onPage={(page) => setParams({ page }, { keepPage: true })}
                    onPageSize={(pageSize) => setParams({ pageSize })}
                    hasFilters={hasFilters}
                    onReset={reset}
                    noun="rows"
                    footer={footer}
                    emptyTitle="No records found for these dates"
                    emptyMessage="Try different dates or clear some filters."
                  />
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </PermissionGuard>
  );
}

export const _i = FileBarChart;