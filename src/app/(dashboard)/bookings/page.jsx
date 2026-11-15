'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import Tabs from '@/components/common/Tabs';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage, { Avatar } from '@/components/common/SmartImage';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import StatusFilter from '@/components/filters/StatusFilter';
import DateRangeFilter from '@/components/filters/DateRangeFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ExportButtons from '@/components/tables/ExportButtons';
import BookingDrawer from '@/features/bookings/BookingDrawer';
import CustomerSelector from '@/components/forms/CustomerSelector';
import CarSelector from '@/components/forms/CarSelector';
import { useBookingActions } from '@/features/bookings/BookingActions';
import { useGetBookingsQuery, useGetBookingStatsQuery, bookingApi } from '@/redux/api/bookingApi';
import { useGetStaffOptionsQuery } from '@/redux/api/staffApi';
import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { BOOKING_STATUSES } from '@/constants';
import { formatPKR } from '@/lib/money';
import { fmtDate, fmtDateTime } from '@/lib/dates';

// useGetStaffOptionsQuery may return an array OR { items } / { data } – always get a list
const asList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : Array.isArray(v?.data) ? v.data : Array.isArray(v?.data?.items) ? v.data.items : []);
const staffOptions = (v) => asList(v).map((s) => ({ value: s.id || s._id, label: s.name || s.fullName || s.email || '' }));

// The API filters the date range by PICK-UP date (and sorts newest first), so that is the default.
const DEFAULTS = { view: 'all', sort: 'createdAt:desc', dateField: 'pickupAt' };
const TABS = [['all', 'All Bookings'], ['upcoming', 'Upcoming'], ['reserved', 'Reserved'], ['active', 'Active Rentals'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['overdue', 'Overdue']];
const EXPORT_COLS = [{ header: 'Booking No', value: (r) => r.number }, { header: 'Booking Date', value: (r) => fmtDate(r.createdAt) }, { header: 'Customer', value: (r) => r.customerName }, { header: 'Car', value: (r) => `${r.carName} (${r.carPlate})` }, { header: 'Pick Up', value: (r) => fmtDateTime(r.pickupAt) }, { header: 'Return', value: (r) => fmtDateTime(r.returnAt) }, { header: 'Status', value: (r) => r.displayStatus }, { header: 'Total', value: (r) => formatPKR(r.total), right: true }, { header: 'Balance', value: (r) => formatPKR(r.balance), right: true }];

export default function BookingsPage() {
  const { params, setParams, reset, hasFilters, apiParams } = useListParams(DEFAULTS);
  const { data, isLoading, isFetching, error, refetch } = useGetBookingsQuery(apiParams);
  const exportAll = useExportAll(bookingApi.endpoints.getBookings, apiParams);
  const { data: staff } = useGetStaffOptionsQuery(); const [viewId, setViewId] = useState(null);
  const { menu, dialogs } = useBookingActions(); const { data: sm } = useGetBookingStatsQuery(); // tab counts (list has no summary)
  const dateLabel = params.dateField === 'pickupAt' ? 'Pick Up' : 'Booking';
  const columns = [
    { key: 'number', header: 'Booking No', sortable: true, render: (b) => <button className="font-bold text-primary" onClick={() => setViewId(b.id)}>{b.number}</button> },
    { key: 'customerName', header: 'Customer', sortable: true, render: (b) => <div className="flex items-center gap-2"><Avatar src={b.customerPhoto} name={b.customerName} size={30} /><span><b className="block">{b.customerName}</b><span className="text-xs text-muted">{b.customerMobile}</span></span></div> },
    { key: 'carName', header: 'Car', render: (b) => <div className="flex items-center gap-2"><SmartImage src={b.carImage} alt="" width={48} height={30} className="rounded" /><span><b className="block">{b.carName}</b><span className="text-xs text-muted">{b.carPlate}</span></span></div> },
    { key: 'pickupAt', header: 'Pick Up', sortable: true, render: (b) => <span className="text-xs whitespace-nowrap">{fmtDateTime(b.pickupAt)}</span> },
    { key: 'returnAt', header: 'Return', sortable: true, render: (b) => <span className={`text-xs whitespace-nowrap ${b.isOverdue ? 'text-danger font-semibold' : ''}`}>{fmtDateTime(b.returnAt)}</span> },
    { key: 'staffName', header: 'Employee', render: (b) => <span className="text-xs">{b.staffName}</span> },
    { key: 'total', header: 'Total', align: 'right', sortable: true, render: (b) => formatPKR(b.total) },
    { key: 'balance', header: 'Balance', align: 'right', sortable: true, render: (b) => <span className={b.balance > 0 ? 'text-danger font-semibold' : 'text-success'}>{formatPKR(b.balance)}</span> },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.displayStatus} /> },
    { key: 'actions', header: 'Action', render: (b) => <TableActions actions={menu(b, { onView: (x) => setViewId(x.id) })} /> },
  ];
  return (
    <>
      <PageHeader title="All Bookings" subtitle="See, change and follow every booking in one place." actions={<PermissionGuard perm="bookings.create"><Link href="/bookings/new" className="btn btn-primary"><Plus size={18} />New Booking</Link></PermissionGuard>} />
      <PageContainer>
        <div className="card px-3 pt-2"><Tabs value={params.view} onChange={(v) => setParams({ view: v })} tabs={TABS.map(([value, label]) => ({ value, label, count: sm?.[value] }))} /></div>
        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><label className="label">Search</label><SearchInput value={params.search || ''} onChange={(v) => setParams({ search: v })} placeholder="Booking no, customer, car or number plate…" /></div>
          <SelectFilter label="Date Filter Applies To" value={params.dateField} onChange={(v) => setParams({ dateField: v })} options={[{ value: 'createdAt', label: 'Booking Date' }, { value: 'pickupAt', label: 'Pick Up Date' }]} allLabel={null} />
          <StatusFilter label="Status" value={params.status || ''} onChange={(v) => setParams({ status: v })} options={BOOKING_STATUSES} />
          <DateRangeFilter from={params.from || ''} to={params.to || ''} onChange={(p) => setParams(p)} fromLabel={`${dateLabel} Date - From`} toLabel={`${dateLabel} Date - To`} />
          <CustomerSelector label="Customer" value={params.customerId || ''} onChange={(v) => setParams({ customerId: v })} placeholder="All Customers" params={{ status: '' }} />
          <CarSelector label="Car" value={params.carId || ''} onChange={(v) => setParams({ carId: v })} placeholder="All Cars" />
          <SelectFilter label="Responsible Employee" value={params.staffId || ''} onChange={(v) => setParams({ staffId: v })} options={staffOptions(staff)} allLabel="All Employees" />
        </FilterPanel>
        <SectionCard title="Bookings" actions={<ExportButtons module="bookings" columns={EXPORT_COLS} loadRows={exportAll} title="Bookings" subtitle={`${dateLabel} date ${params.from || 'start'} to ${params.to || 'today'}`} filename="bookings" />}>
          <DataTable columns={columns} data={data} isLoading={isLoading} isFetching={isFetching} error={error} onRetry={refetch} sort={params.sort} onSort={(v) => setParams({ sort: v })} onPage={(p) => setParams({ page: p }, { keepPage: true })} onPageSize={(n) => setParams({ pageSize: n })} hasFilters={hasFilters || params.view !== 'all'} onReset={reset} noun="bookings"
            emptyTitle="No bookings yet" emptyMessage="Create a booking to see it here." emptyAction={<Link href="/bookings/new" className="btn btn-primary">New Booking</Link>} />
        </SectionCard>
      </PageContainer>
      <BookingDrawer id={viewId} onClose={() => setViewId(null)} />
      {dialogs}
    </>
  );
}