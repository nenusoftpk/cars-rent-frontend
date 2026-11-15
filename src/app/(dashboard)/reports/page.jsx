'use client';

import { FileBarChart } from 'lucide-react';

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

import { REPORTS, FLAT, totalsRow } from '@/features/reports/reportConfig';
import { useGetReportQuery, reportApi } from '@/redux/api/reportApi';
import { useGetDriversQuery } from '@/redux/api/driverApi';
import { useGetStaffOptionsQuery } from '@/redux/api/staffApi';

import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const { can } = useAuth();

  const {
    params,
    setParams,
    reset,
    hasFilters,
  } = useListParams({ report: 'cars-status' });

  // Only show money reports when the user has financial permission
  const allowed = FLAT.filter((r) => !r.money || can('financial:view'));
  const cfg = allowed.find((r) => r.id === params.report) || allowed[0];

  // Build the exact query the backend expects
  const queryArgs = {
    name: cfg?.id,
    ...Object.fromEntries(
      Object.entries(params).filter(([key]) => key !== 'report')
    ),
  };

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetReportQuery(queryArgs, {
    skip: !cfg?.id,
  });

  const exportAll = useExportAll(reportApi.endpoints.getReport, queryArgs);

  // Lazy-load filter options only when needed
  const { data: drivers } = useGetDriversQuery(
    { pageSize: 100 },
    { skip: !cfg?.filters?.includes('driver') }
  );

  const { data: staff } = useGetStaffOptionsQuery(undefined, {
    skip: !cfg?.filters?.includes('staff'),
  });

  const hasFilter = (key) => cfg?.filters?.includes(key);

  // Safe staff options (handles different response shapes)
  const staffOptions = Array.isArray(staff)
    ? staff
    : Array.isArray(staff?.items)
      ? staff.items
      : Array.isArray(staff?.data)
        ? staff.data
        : [];

  // --------------------------------------------------
  // Columns – map reportConfig definition → DataTable
  // --------------------------------------------------
  const columns = (cfg?.cols || []).map((col) => ({
    key: col.key,
    header: col.header,
    sortable: col.sortable,
    align: col.align,
    render: (row) => {
      if (col.kind === 'status') {
        return <StatusBadge status={row[col.key]} />;
      }
      // Support nested paths (e.g. customer.name)
      const value = col.key.includes('.')
        ? col.key.split('.').reduce((acc, k) => acc?.[k], row)
        : row[col.key];

      return col.fmt ? col.fmt(value) : value ?? '—';
    },
  }));

  // Export columns (plain values)
  const exportColumns = (cfg?.cols || []).map((col) => ({
    header: col.header,
    value: (row) => {
      const value = col.key.includes('.')
        ? col.key.split('.').reduce((acc, k) => acc?.[k], row)
        : row[col.key];
      return col.fmt ? col.fmt(value) : value ?? '';
    },
    right: col.align === 'right',
  }));

  // Footer totals row (backend returns `totals`)
  const totals = data?.totals;
  const footer =
    totals && Object.keys(totals).length > 0 ? (
      <tr>
        {(cfg?.cols || []).map((col, index) => (
          <td
            key={col.key}
            className={col.align === 'right' ? 'text-right' : ''}
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
    ) : null;

  // Switch report (reset other filters)
  const chooseReport = (id) => {
    reset();
    // small delay so reset finishes before setting the new report
    setTimeout(() => setParams({ report: id }), 0);
  };

  return (
    <PermissionGuard perm="reports.view" page>
      <PageHeader
        title="Reports"
        subtitle="Simple reports you can print or save as PDF and Excel."
      />

      <PageContainer>
        <div className="grid gap-4 lg:grid-cols-[250px_1fr] items-start">
          {/* ---------- Left navigation ---------- */}
          <nav
            aria-label="Reports"
            className="card p-2 lg:sticky lg:top-20"
          >
            {REPORTS.map((group) => {
              const items = group.items.filter((item) =>
                allowed.includes(item)
              );
              if (!items.length) return null;

              return (
                <div key={group.group} className="mb-1">
                  <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                    {group.group}
                  </p>
                  <div className="flex lg:block gap-1 overflow-x-auto">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => chooseReport(item.id)}
                        aria-current={cfg?.id === item.id ? 'page' : undefined}
                        className={cn(
                          'w-full text-left whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium',
                          cfg?.id === item.id
                            ? 'bg-primary text-white'
                            : 'hover:bg-soft'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {!can('financial:view') && (
              <p className="text-xs text-muted p-3">
                Money reports are available to the owner.
              </p>
            )}
          </nav>

          {/* ---------- Main content ---------- */}
          <div className="space-y-4 min-w-0">
            <FilterPanel
              onReset={reset}
              cols="sm:grid-cols-2 xl:grid-cols-3"
            >
              {/* Search – always available */}
              <div>
                <label className="label">Search</label>
                <SearchInput
                  value={params.search || ''}
                  onChange={(value) => setParams({ search: value })}
                  placeholder="Search this report…"
                />
              </div>

              {/* Date range */}
              {hasFilter('date') && (
                <DateRangeFilter
                  from={params.from || ''}
                  to={params.to || ''}
                  onChange={(range) => setParams(range)}
                  fromLabel={`From (${cfg?.dateLabel || 'date'})`}
                  toLabel={`To (${cfg?.dateLabel || 'date'})`}
                />
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
                  options={(drivers?.items || []).map((d) => ({
                    value: d.id,
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
                    value: s.id,
                    label: s.name,
                  }))}
                  allLabel="All Employees"
                />
              )}
            </FilterPanel>

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
                      ? `${params.from} to ${params.to || 'today'}`
                      : ''
                  }
                  filename={cfg?.id}
                  totals={(rows) =>
                    totalsRow(cfg, rows?.totals ?? data?.totals)
                  }
                />
              }
            >
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
                emptyMessage="Try different dates or filters."
              />
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </PermissionGuard>
  );
}

export const _i = FileBarChart;