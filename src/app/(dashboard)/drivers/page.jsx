// PATH: src/app/drivers/page.jsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Plus,
  UserRound,
  UserCheck,
  UserCog,
  UserX,
  Eye,
  Pencil,
  Trash2,
  Wallet,
  History,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage, { Avatar } from '@/components/common/SmartImage';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ExportButtons from '@/components/tables/ExportButtons';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import DetailDrawer from '@/components/modals/DetailDrawer';
import NetworkError from '@/components/feedback/NetworkError';
import DriverFormModal from '@/features/drivers/DriverFormModal';
import {
  useGetDriversQuery,
  useGetDriverQuery,
  useGetDriverStatsQuery,
  useGetDriverBookingsQuery,
  useGetDriverPaymentsQuery,
  useGetDriverOverviewQuery,
  useDeleteDriverMutation,
  driverApi,
} from '@/redux/api/driverApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { useAuth } from '@/hooks/useAuth';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { formatPKR } from '@/lib/money';

/* ------------------------------------------------------------------ */
/* Status helpers                                                     */
/* ------------------------------------------------------------------ */
// Backend formatDriver returns:
//   status     → "Active" | "Inactive"   (display)
//   rawStatus  → "available" | "assigned" | "inactive"
const getRawStatus = (d) => {
  if (d.rawStatus) return d.rawStatus;
  if (d.status === 'Active') return 'available';
  if (d.status === 'Inactive') return 'inactive';
  return d.status || 'available';
};

const STATUS_META = {
  available: { label: 'Available', tone: 'success' },
  assigned: { label: 'Assigned', tone: 'info' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

const DriverStatus = ({ driver }) => {
  const raw = getRawStatus(driver);
  const s = STATUS_META[raw] || { label: raw || '-', tone: 'neutral' };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
};

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'inactive', label: 'Inactive' },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const pick = (o, keys, d) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k];
  return d;
};

const isExpired = (d) => !!d && new Date(d).getTime() < Date.now();

const paymentText = (d) => {
  if (d.paymentMode === 'salary' || (Number(d.salary) > 0 && Number(d.paymentRate) === 0)) {
    return `Salary ${formatPKR(d.salary || 0)}/mo`;
  }
  if (d.paymentType === 'percentage') {
    return `${d.paymentRate ?? 0}% of rental`;
  }
  return `${formatPKR(d.paymentRate ?? 0)} fixed / booking`;
};

const EXP = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Phone', value: (r) => r.phone },
  { header: 'Licence No', value: (r) => r.licenseNumber || r.licenseNo },
  {
    header: 'Licence Expiry',
    value: (r) => (r.licenseExpiry ? fmtDate(r.licenseExpiry) : ''),
  },
  { header: 'Salary', value: (r) => r.salary, right: true },
  { header: 'Driver Payment', value: (r) => paymentText(r) },
  {
    header: 'Status',
    value: (r) => STATUS_META[getRawStatus(r)]?.label || r.status,
  },
];

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <span className="text-muted shrink-0">{label}</span>
    <span className="font-medium text-right">{children || '—'}</span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Detail Drawer (profile + financials + bookings + payments)         */
/* ------------------------------------------------------------------ */
function DriverDrawer({ id, onClose }) {
  const {
    data: overview,
    isLoading,
    error,
    refetch,
  } = useGetDriverOverviewQuery(id, { skip: !id });

  const d = overview?.driver;
  const summary = overview?.summary || {};
  const bookings = overview?.bookings || [];
  const payments = overview?.payments || [];

  return (
    <DetailDrawer open={!!id} onClose={onClose} title="Driver Details" wide>
      {isLoading ? (
        <div className="skeleton h-72" />
      ) : error ? (
        <NetworkError error={error} onRetry={refetch} />
      ) : (
        d && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Avatar src={d.photo} name={d.name} size={72} />
              <div>
                <h3 className="text-xl font-extrabold">{d.name}</h3>
                <p className="text-sm text-muted">{d.phone}</p>
                <div className="mt-1">
                  <DriverStatus driver={d} />
                </div>
              </div>
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-center">
                <p className="text-xs text-muted">Earned</p>
                <p className="font-bold text-primary">{formatPKR(summary.totalEarned)}</p>
              </div>
              <div className="rounded-xl bg-success/5 border border-success/20 px-3 py-2 text-center">
                <p className="text-xs text-muted">Paid</p>
                <p className="font-bold text-success">{formatPKR(summary.totalPaid)}</p>
              </div>
              <div className="rounded-xl bg-danger/5 border border-danger/20 px-3 py-2 text-center">
                <p className="text-xs text-muted">Pending</p>
                <p className="font-bold text-danger">{formatPKR(summary.totalPending)}</p>
              </div>
            </div>

            {/* Profile */}
            <div className="rounded-xl border border-line px-3 py-1 divide-y divide-line">
              <Row label="Email">{d.email}</Row>
              <Row label="Address">{d.address}</Row>
              <Row label="CNIC">{d.cnic}</Row>
              <Row label="Licence No">{d.licenseNumber || d.licenseNo}</Row>
              <Row label="Licence Expiry">
                {d.licenseExpiry ? (
                  <span className={isExpired(d.licenseExpiry) ? 'text-danger' : ''}>
                    {fmtDate(d.licenseExpiry)}
                    {isExpired(d.licenseExpiry) ? ' (expired)' : ''}
                  </span>
                ) : null}
              </Row>
              <Row label="Monthly Salary">{formatPKR(d.salary ?? 0)}</Row>
              <Row label="Driver Payment">{paymentText(d)}</Row>
            </div>

            {/* Documents */}
            <div className="flex gap-3 flex-wrap">
              {[
                ['licenseImage', 'Licence'],
                ['cnicFront', 'CNIC Front'],
                ['cnicBack', 'CNIC Back'],
              ].map(
                ([k, label]) =>
                  d[k] && (
                    <div key={k}>
                      <p className="text-xs text-muted mb-1">{label}</p>
                      <SmartImage
                        src={d[k]}
                        alt={label}
                        width={200}
                        height={120}
                        className="w-40 rounded-xl border border-line"
                      />
                    </div>
                  )
              )}
            </div>

            {/* Recent bookings */}
            <div>
              <h4 className="font-bold mb-2">
                Recent Bookings ({bookings.length})
              </h4>
              {bookings.length ? (
                <ul className="divide-y divide-line">
                  {bookings.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/bookings/${b.id}`}
                        className="flex items-center gap-3 py-2.5 hover:bg-soft rounded-lg px-1"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {b.bookingNumber} · {b.customerName}
                          </p>
                          <p className="text-xs text-muted">
                            {b.carName} · {fmtDate(b.pickupDate)} – {fmtDate(b.returnDate)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <StatusBadge status={b.status} />
                          {b.pending > 0 && (
                            <p className="text-xs text-danger mt-0.5">
                              Pending {formatPKR(b.pending)}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No bookings yet.</p>
              )}
            </div>

            {/* Recent payments */}
            <div>
              <h4 className="font-bold mb-2">
                Recent Payments ({payments.length})
              </h4>
              {payments.length ? (
                <ul className="divide-y divide-line">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{p.title || 'Driver Payment'}</p>
                        <p className="text-xs text-muted">
                          {fmtDateTime(p.paymentDate)} · {p.paymentMethod}
                        </p>
                      </div>
                      <b className="text-success">{formatPKR(p.amount)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No payments recorded yet.</p>
              )}
            </div>
          </div>
        )
      )}
    </DetailDrawer>
  );
}

/* ------------------------------------------------------------------ */
/* Payments-only drawer                                               */
/* ------------------------------------------------------------------ */
function DriverPaymentsDrawer({ id, onClose }) {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useGetDriverPaymentsQuery(
    { id, pageSize: 50 },
    { skip: !id }
  );

  const driver = data?.driver;
  const summary = data?.summary || {};
  const items = data?.items || [];

  return (
    <DetailDrawer open={!!id} onClose={onClose} title="Driver Payment History" wide>
      {isLoading ? (
        <div className="skeleton h-64" />
      ) : error ? (
        <NetworkError error={error} onRetry={refetch} />
      ) : (
        <>
          {driver && (
            <div className="flex items-center gap-3 mb-4">
              <Avatar src={driver.photo} name={driver.name} size={48} />
              <div>
                <p className="font-bold">{driver.name}</p>
                <p className="text-xs text-muted">{driver.phone}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-center">
              <p className="text-xs text-muted">Earned</p>
              <p className="font-bold text-primary">{formatPKR(summary.totalEarned)}</p>
            </div>
            <div className="rounded-xl bg-success/5 border border-success/20 px-3 py-2 text-center">
              <p className="text-xs text-muted">Paid</p>
              <p className="font-bold text-success">{formatPKR(summary.totalPaid)}</p>
            </div>
            <div className="rounded-xl bg-danger/5 border border-danger/20 px-3 py-2 text-center">
              <p className="text-xs text-muted">Pending</p>
              <p className="font-bold text-danger">{formatPKR(summary.totalPending)}</p>
            </div>
          </div>

          {items.length ? (
            <ul className="divide-y divide-line">
              {items.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="text-xs text-muted">
                      {fmtDateTime(p.paymentDate)} · {p.paymentMethod}
                      {p.bookingNumber ? ` · ${p.bookingNumber}` : ''}
                    </p>
                    {p.description && (
                      <p className="text-xs text-muted mt-0.5">{p.description}</p>
                    )}
                  </div>
                  <b className="text-success shrink-0 ml-3">{formatPKR(p.amount)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted py-6 text-center">
              No driver payments recorded yet.
            </p>
          )}
        </>
      )}
    </DetailDrawer>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                          */
/* ------------------------------------------------------------------ */
export default function DriversPage() {
  const { params, setParams, reset, hasFilters, apiParams } = useListParams({
    sort: 'name:asc',
  });
  const { can } = useAuth();

  const { data, isLoading, isFetching, error, refetch } = useGetDriversQuery(apiParams);
  const stats = useGetDriverStatsQuery();
  const exportAll = useExportAll(driverApi.endpoints.getDrivers, apiParams);

  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [payId, setPayId] = useState(null);
  const [remove, { isLoading: deleting }] = useDeleteDriverMutation();

  const st = stats.data || {};
  const total = pick(st, ['total', 'totalDrivers'], data?.total);
  const available = pick(st, ['available', 'availableDrivers']);
  const assigned = pick(st, ['assigned', 'assignedDrivers']);
  const inactive = pick(st, ['inactive', 'inactiveDrivers']);
  const sl = stats.isLoading;

  const confirmDelete = async () => {
    try {
      await remove(del.id).unwrap();
      toast.success('Driver deleted');
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setDel(null);
  };

  const cols = [
    {
      key: 'name',
      header: 'Driver',
      sortable: true,
      render: (d) => (
        <button
          className="flex items-center gap-2.5 text-left"
          onClick={() => setViewId(d.id)}
        >
          <Avatar src={d.photo} name={d.name} size={36} />
          <b>{d.name}</b>
        </button>
      ),
    },
    { key: 'phone', header: 'Phone' },
    {
      key: 'licenseNumber',
      header: 'Licence No',
      render: (d) => d.licenseNumber || d.licenseNo || '—',
    },
    {
      key: 'licenseExpiry',
      header: 'Licence Expiry',
      render: (d) =>
        d.licenseExpiry ? (
          <span className={isExpired(d.licenseExpiry) ? 'badge badge-danger' : 'text-xs'}>
            {fmtDate(d.licenseExpiry)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'salary',
      header: 'Salary',
      align: 'right',
      render: (d) => formatPKR(d.salary ?? 0),
    },
    {
      key: 'paymentRate',
      header: 'Driver Payment',
      render: (d) => <span className="text-xs">{paymentText(d)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => <DriverStatus driver={d} />,
    },
    {
      key: 'a',
      header: 'Action',
      render: (d) => (
        <TableActions
          actions={[
            {
              label: 'View Details',
              icon: Eye,
              onClick: () => setViewId(d.id),
            },
            {
              label: 'Payment History',
              icon: Wallet,
              onClick: () => setPayId(d.id),
            },
            {
              label: 'Edit',
              icon: Pencil,
              onClick: () => setForm(d),
              hidden: !can('drivers:edit') && !can('drivers.update'),
            },
            {
              label: 'Delete',
              icon: Trash2,
              danger: true,
              onClick: () => setDel(d),
              hidden: !can('drivers:delete') && !can('drivers.delete'),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <PermissionGuard perm="drivers.view" page>
      <PageHeader
        title="Drivers"
        subtitle="Drivers who can be assigned to bookings. Track salary and per-booking payments."
        actions={
          <PermissionGuard perm="drivers.create">
            <button className="btn btn-primary" onClick={() => setForm({})}>
              <Plus size={18} />
              Add Driver
            </button>
          </PermissionGuard>
        }
      />

      <PageContainer>
        {/* Stats */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={UserRound}
            tone="blue"
            label="Total Drivers"
            value={total}
            loading={sl && isLoading}
          />
          <StatCard
            icon={UserCheck}
            tone="green"
            label="Available"
            value={available}
            loading={sl}
          />
          <StatCard
            icon={UserCog}
            tone="orange"
            label="Assigned"
            value={assigned}
            loading={sl}
            hint="On a booking right now"
          />
          <StatCard
            icon={UserX}
            tone="red"
            label="Inactive"
            value={inactive}
            loading={sl}
          />
        </div>

        {/* Filters */}
        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchInput
              value={params.search || ''}
              onChange={(v) => setParams({ search: v })}
              placeholder="Name, phone, CNIC or licence number…"
            />
          </div>
          <SelectFilter
            label="Status"
            value={params.status || ''}
            onChange={(v) => setParams({ status: v })}
            options={STATUS_OPTIONS}
            allLabel="All Statuses"
          />
        </FilterPanel>

        {/* Table */}
        <SectionCard
          title="Driver List"
          actions={
            <ExportButtons
              module="drivers"
              columns={EXP}
              loadRows={exportAll}
              title="Drivers"
              filename="drivers"
            />
          }
        >
          <DataTable
            columns={cols}
            data={data}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
            sort={params.sort}
            onSort={(v) => setParams({ sort: v })}
            onPage={(p) => setParams({ page: p }, { keepPage: true })}
            onPageSize={(n) => setParams({ pageSize: n })}
            hasFilters={hasFilters}
            onReset={reset}
            noun="drivers"
            emptyTitle="No drivers yet"
            emptyMessage="Add a driver to assign them to bookings."
          />
        </SectionCard>
      </PageContainer>

      {/* Modals / Drawers */}
      <DriverFormModal
        open={!!form}
        driver={form}
        onClose={() => setForm(null)}
      />

      <DriverDrawer id={viewId} onClose={() => setViewId(null)} />
      <DriverPaymentsDrawer id={payId} onClose={() => setPayId(null)} />

      <ConfirmDialog
        open={!!del}
        danger
        title="Delete this driver?"
        message={`“${del?.name}” will be permanently deleted. Drivers with booking or payment history cannot be deleted – mark them inactive instead.`}
        confirmLabel="Delete Driver"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDel(null)}
      />
    </PermissionGuard>
  );
}