'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Users, UserCheck, Wallet, UserPlus, Plus, Eye, Pencil, CalendarPlus, BookOpen, Printer, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Avatar } from '@/components/common/SmartImage';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import StatusFilter from '@/components/filters/StatusFilter';
import SortDropdown from '@/components/filters/SortDropdown';
import DateRangeFilter from '@/components/filters/DateRangeFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ExportButtons from '@/components/tables/ExportButtons';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import CustomerFormModal from '@/features/customers/CustomerFormModal';
import CustomerDrawer from '@/features/customers/CustomerDrawer';
import { useGetCustomersQuery, useDeleteCustomerMutation, useLazyGetCustomerQuery, customerApi } from '@/redux/api/customerApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { useAuth } from '@/hooks/useAuth';
import { CITIES, CUSTOMER_TYPES } from '@/constants';
import { formatPKR } from '@/lib/money';
import { fmtDate } from '@/lib/dates';
import { printHtml, customerDoc } from '@/lib/printTemplates';

const SORTS = [{ value: 'createdAt:desc', label: 'Sort by: Newest' }, { value: 'name:asc', label: 'Name (A-Z)' }, { value: 'totalSpent:desc', label: 'Highest spent' }, { value: 'pending:desc', label: 'Highest balance due' }, { value: 'totalBookings:desc', label: 'Most bookings' }];
const DEFAULTS = { sort: 'createdAt:desc' };
const EXPORT_COLS = [{ header: 'Name', value: (r) => r.name }, { header: 'Mobile', value: (r) => r.mobile }, { header: 'CNIC', value: (r) => r.cnic }, { header: 'City', value: (r) => r.city }, { header: 'Bookings', value: (r) => r.totalBookings, right: true }, { header: 'Total Spent', value: (r) => formatPKR(r.totalSpent), right: true }, { header: 'Balance Due', value: (r) => formatPKR(r.pending), right: true }, { header: 'Status', value: (r) => r.status }];

export default function CustomersPage() {
  const router = useRouter(); const { params, setParams, reset, hasFilters, apiParams } = useListParams(DEFAULTS); const { can } = useAuth();
  const { data, isLoading, isFetching, error, refetch } = useGetCustomersQuery(apiParams);
  const exportAll = useExportAll(customerApi.endpoints.getCustomers, apiParams);
  const [form, setForm] = useState(null); const [viewId, setViewId] = useState(null); const [del, setDel] = useState(null);
  const [remove, { isLoading: deleting }] = useDeleteCustomerMutation();
  const [fetchCustomer] = useLazyGetCustomerQuery();
  const sm = data?.summary; const L = isLoading;

  const canViewSensitive = can('sensitive:view') || can('customers.documents.view');

  /** Always load the full customer (documents + guarantors) before printing. */
  const handlePrint = async (row) => {
    try {
      toast.message('Preparing full customer print…');
      const full = await fetchCustomer(row.id).unwrap();
      printHtml(customerDoc(full, canViewSensitive), 'Customer');
    } catch (e) {
      toast.error(errorMessage(e) || 'Could not load full details; printing basic info.');
      printHtml(customerDoc(row, canViewSensitive), 'Customer');
    }
  };

  const confirmDelete = async () => { try { await remove(del.id).unwrap(); toast.success('Customer deleted'); setDel(null); } catch (e) { toast.error(errorMessage(e)); setDel(null); } };
  const columns = [
    { key: 'n', header: '#', render: (r, i) => String(i).padStart(2, '0') },
    { key: 'name', header: 'Customer', sortable: true, render: (r) => <button className="flex items-center gap-2.5 text-left" onClick={() => setViewId(r.id)}><Avatar src={r.photo} name={r.name} size={36} /><span className="font-semibold">{r.name}</span>{r.type && <StatusBadge status={r.type} />}</button> },
    { key: 'mobile', header: 'Mobile', render: (r) => <span className="rounded-md bg-soft px-2 py-1 text-xs">{r.mobile}</span> },
    { key: 'cnic', header: 'CNIC', render: (r) => <span className="text-xs">{r.cnic}</span> },
    { key: 'city', header: 'City', sortable: true },
    { key: 'totalBookings', header: 'Total Bookings', sortable: true, align: 'right' },
    { key: 'totalSpent', header: 'Total Spent', sortable: true, align: 'right', render: (r) => <b>{formatPKR(r.totalSpent)}</b> },
    { key: 'pending', header: 'Remaining Balance', sortable: true, align: 'right', render: (r) => <span className={r.pending > 0 ? 'badge badge-danger' : ''}>{formatPKR(r.pending)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: 'Action', render: (r) => <TableActions actions={[
      { label: 'View', icon: Eye, onClick: () => setViewId(r.id) }, { label: 'Edit', icon: Pencil, onClick: () => setForm(r), hidden: !can('customers:edit') },
      { label: 'New Booking', icon: CalendarPlus, onClick: () => router.push(`/bookings/new?customerId=${r.id}`), hidden: !can('bookings:create') },
      { label: 'Customer Khata', icon: BookOpen, onClick: () => router.push(`/customer-ledger?customerId=${r.id}`), hidden: !can('ledger:view') },
      { label: 'Print Details', icon: Printer, onClick: () => handlePrint(r), hidden: !can('customers:print') },
      { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDel(r), hidden: !can('customers:delete') }]} /> },
  ];
  return (
    <>
      <PageHeader title="Customers" subtitle="Manage your customers, documents, booking history and balances." actions={<PermissionGuard perm="customers.create"><button className="btn btn-primary" onClick={() => setForm({})}><Plus size={18} />Add Customer</button></PermissionGuard>} />
      <PageContainer>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard loading={L} icon={Users} tone="blue" label="Total Customers" value={sm?.total} hint="All registered customers" href="/customers" />
          <StatCard loading={L} icon={UserCheck} tone="green" label="Active Customers" value={sm?.active} hint="Can book cars" href="/customers?status=Active" />
          <StatCard loading={L} icon={Wallet} tone="orange" label="Pending Balance" value={sm?.pending} hint="Customers who owe money" href="/customers?hasDues=true" />
          <StatCard loading={L} icon={UserPlus} tone="red" label="New This Month" value={sm?.newThisMonth} hint="Recently added" />
        </div>
        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="sm:col-span-2"><label className="label">Search</label><SearchInput value={params.search || ''} onChange={(v) => setParams({ search: v })} placeholder="Search by name, mobile or CNIC…" /></div>
          <StatusFilter label="Status" value={params.status || ''} onChange={(v) => setParams({ status: v })} options={['Active', 'Inactive']} />
          <SelectFilter label="City" value={params.city || ''} onChange={(v) => setParams({ city: v })} options={CITIES} allLabel="All Cities" />
          <SelectFilter label="Type" value={params.type || ''} onChange={(v) => setParams({ type: v })} options={[...CUSTOMER_TYPES, 'None']} allLabel="All Types" />
          <SortDropdown label="Sort" value={params.sort} onChange={(v) => setParams({ sort: v })} options={SORTS} />
          <DateRangeFilter from={params.from || ''} to={params.to || ''} onChange={(p) => setParams(p)} fromLabel="Added From" toLabel="Added To" />
        </FilterPanel>
        <SectionCard title="Customer List" actions={<ExportButtons module="customers" columns={EXPORT_COLS} loadRows={exportAll} title="Customers" filename="customers" />}>
          <DataTable columns={columns} data={data} isLoading={isLoading} isFetching={isFetching} error={error} onRetry={refetch} sort={params.sort} onSort={(v) => setParams({ sort: v })}
            onPage={(p) => setParams({ page: p }, { keepPage: true })} onPageSize={(n) => setParams({ pageSize: n })} hasFilters={hasFilters} onReset={reset} noun="customers"
            emptyTitle="No customers yet" emptyMessage="Add your first customer to start making bookings." emptyAction={can('customers:create') && <button className="btn btn-primary" onClick={() => setForm({})}><Plus size={16} />Add Customer</button>} />
        </SectionCard>
      </PageContainer>
      <CustomerFormModal open={!!form} customer={form} onClose={() => setForm(null)} />
      <CustomerDrawer id={viewId} onClose={() => setViewId(null)} onEdit={(c) => { setViewId(null); setForm(c); }} />
      <ConfirmDialog open={!!del} danger title="Delete customer?" message={`“${del?.name}” will be deleted. This cannot be undone.`} confirmLabel="Delete Customer" loading={deleting} onConfirm={confirmDelete} onCancel={() => setDel(null)} />
    </>
  );
}
export const _l = [fmtDate];
