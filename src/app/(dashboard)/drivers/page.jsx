// PATH: src/app/drivers/page.jsx   (REPLACE your existing Drivers page)
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, UserRound, UserCheck, UserCog, UserX, Eye, Pencil, Trash2 } from 'lucide-react';
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
  useDeleteDriverMutation,
  driverApi,
} from '@/redux/api/driverApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { useAuth } from '@/hooks/useAuth';
import { fmtDate } from '@/lib/dates';
import { formatPKR } from '@/lib/money';

// backend Driver.status enum: available | assigned | inactive
const STATUS = {
  available: { label: 'Available', tone: 'success' },
  assigned: { label: 'Assigned', tone: 'info' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, { label }]) => ({ value, label }));
const DriverStatus = ({ status }) => {
  const s = STATUS[status] || { label: status || '-', tone: 'neutral' };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
};

const pick = (o, keys, d) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k];
  return d;
};
const isExpired = (d) => !!d && new Date(d).getTime() < Date.now();
const paymentText = (d) => (d.paymentType === 'percentage' ? `${d.paymentRate ?? 0}% of booking` : `${formatPKR(d.paymentRate ?? 0)} fixed`);

const EXP = [
  { header: 'Name', value: (r) => r.name },
  { header: 'Phone', value: (r) => r.phone },
  { header: 'Licence No', value: (r) => r.licenseNumber },
  { header: 'Licence Expiry', value: (r) => (r.licenseExpiry ? fmtDate(r.licenseExpiry) : '') },
  { header: 'Salary', value: (r) => r.salary, right: true },
  { header: 'Driver Payment', value: (r) => paymentText(r) },
  { header: 'Status', value: (r) => STATUS[r.status]?.label || r.status },
];

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <span className="text-muted">{label}</span>
    <span className="font-medium text-right">{children || '-'}</span>
  </div>
);

function DriverDrawer({ id, onClose }) {
  const { data: d, isLoading, error, refetch } = useGetDriverQuery(id, { skip: !id });
  const { data: bk } = useGetDriverBookingsQuery({ id, pageSize: 20 }, { skip: !id });
  const bookings = bk?.items || [];

  return (
    <DetailDrawer open={!!id} onClose={onClose} title="Driver Details">
      {isLoading ? (
        <div className="skeleton h-64" />
      ) : error ? (
        <NetworkError error={error} onRetry={refetch} />
      ) : (
        d && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar src={d.photo} name={d.name} size={72} />
              <div>
                <h3 className="text-xl font-extrabold">{d.name}</h3>
                <p className="text-sm text-muted">{d.phone}</p>
                <DriverStatus status={d.status} />
              </div>
            </div>

            <div className="rounded-xl border border-line px-3 py-1 divide-y divide-line">
              <Row label="Email">{d.email}</Row>
              <Row label="Address">{d.address}</Row>
              <Row label="CNIC">{d.cnic}</Row>
              <Row label="Licence No">{d.licenseNumber}</Row>
              <Row label="Licence Expiry">
                {d.licenseExpiry ? (
                  <span className={isExpired(d.licenseExpiry) ? 'text-danger' : ''}>
                    {fmtDate(d.licenseExpiry)}{isExpired(d.licenseExpiry) ? ' (expired)' : ''}
                  </span>
                ) : null}
              </Row>
              <Row label="Monthly Salary">{formatPKR(d.salary ?? 0)}</Row>
              <Row label="Driver Payment">{paymentText(d)}</Row>
            </div>

            <div className="flex gap-3 flex-wrap">
              {[['licenseImage', 'Licence'], ['cnicFront', 'CNIC Front'], ['cnicBack', 'CNIC Back']].map(
                ([k, label]) =>
                  d[k] && (
                    <div key={k}>
                      <p className="text-xs text-muted mb-1">{label}</p>
                      <SmartImage src={d[k]} alt={label} width={220} height={140} className="w-44 rounded-xl border border-line" />
                    </div>
                  )
              )}
            </div>

            <h4 className="font-bold">Booking History ({bk?.total ?? bookings.length})</h4>
            {bookings.length ? (
              <ul className="divide-y divide-line">
                {bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 py-2 hover:bg-soft rounded-lg px-1">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{b.number} · {b.customerName}</p>
                        <p className="text-xs text-muted">{b.carName} · {fmtDate(b.pickupAt)} - {fmtDate(b.returnAt)}</p>
                      </div>
                      <StatusBadge status={b.displayStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No bookings assigned yet.</p>
            )}
          </div>
        )
      )}
    </DetailDrawer>
  );
}

export default function DriversPage() {
  const { params, setParams, reset, hasFilters, apiParams } = useListParams({ sort: 'name:asc' });
  const { can } = useAuth();

  const { data, isLoading, isFetching, error, refetch } = useGetDriversQuery(apiParams);
  const stats = useGetDriverStatsQuery();
  const exportAll = useExportAll(driverApi.endpoints.getDrivers, apiParams);

  const [form, setForm] = useState(null);
  const [del, setDel] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [remove, { isLoading: deleting }] = useDeleteDriverMutation();

  // /drivers/stats - tolerant of the usual key names
  const st = stats.data || {};
  const total = pick(st, ['total', 'totalDrivers'], data?.total);
  const available = pick(st, ['available', 'availableDrivers'], undefined);
  const assigned = pick(st, ['assigned', 'assignedDrivers'], undefined);
  const inactive = pick(st, ['inactive', 'inactiveDrivers'], undefined);
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
        <button className="flex items-center gap-2.5 text-left" onClick={() => setViewId(d.id)}>
          <Avatar src={d.photo} name={d.name} size={36} />
          <b>{d.name}</b>
        </button>
      ),
    },
    { key: 'phone', header: 'Phone' },
    { key: 'licenseNumber', header: 'Licence No', render: (d) => d.licenseNumber || '-' },
    {
      key: 'licenseExpiry',
      header: 'Licence Expiry',
      render: (d) =>
        d.licenseExpiry ? (
          <span className={isExpired(d.licenseExpiry) ? 'badge badge-danger' : 'text-xs'}>{fmtDate(d.licenseExpiry)}</span>
        ) : (
          '-'
        ),
    },
    { key: 'salary', header: 'Salary', align: 'right', render: (d) => formatPKR(d.salary ?? 0) },
    { key: 'paymentRate', header: 'Driver Payment', render: (d) => <span className="text-xs">{paymentText(d)}</span> },
    { key: 'status', header: 'Status', render: (d) => <DriverStatus status={d.status} /> },
    {
      key: 'a',
      header: 'Action',
      render: (d) => (
        <TableActions
          actions={[
            { label: 'View History', icon: Eye, onClick: () => setViewId(d.id) },
            { label: 'Edit', icon: Pencil, onClick: () => setForm(d), hidden: !can('drivers:edit') },
            { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDel(d), hidden: !can('drivers:delete') },
          ]}
        />
      ),
    },
  ];

  return (
    <PermissionGuard perm="drivers.view" page>
      <PageHeader
        title="Drivers"
        subtitle="Drivers who can be assigned to bookings."
        actions={
          <PermissionGuard perm="drivers.create">
            <button className="btn btn-primary" onClick={() => setForm({})}><Plus size={18} />Add Driver</button>
          </PermissionGuard>
        }
      />
      <PageContainer>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={UserRound} tone="blue" label="Total Drivers" value={total} loading={sl && isLoading} href="/drivers" />
          <StatCard icon={UserCheck} tone="green" label="Available" value={available} loading={sl} href="/drivers?status=available" />
          <StatCard icon={UserCog} tone="orange" label="Assigned" value={assigned} loading={sl} href="/drivers?status=assigned" hint="On a booking now" />
          <StatCard icon={UserX} tone="red" label="Inactive" value={inactive} loading={sl} href="/drivers?status=inactive" />
        </div>

        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchInput value={params.search || ''} onChange={(v) => setParams({ search: v })} placeholder="Name, phone or licence number…" />
          </div>
          <SelectFilter label="Status" value={params.status || ''} onChange={(v) => setParams({ status: v })} options={STATUS_OPTIONS} allLabel="All Statuses" />
        </FilterPanel>

        <SectionCard title="Driver List" actions={<ExportButtons module="drivers" columns={EXP} loadRows={exportAll} title="Drivers" filename="drivers" />}>
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

      <DriverFormModal open={!!form} driver={form} onClose={() => setForm(null)} />
      <DriverDrawer id={viewId} onClose={() => setViewId(null)} />
      <ConfirmDialog
        open={!!del}
        danger
        title="Delete driver?"
        message={`“${del?.name}” will be deleted.`}
        confirmLabel="Delete Driver"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDel(null)}
      />
    </PermissionGuard>
  );
}