// PATH: src/app/staff/page.jsx   (REPLACE your existing Staff / Users page)
'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Users, UserCheck, UserX, Pencil, ShieldCheck, KeyRound, Ban, CircleCheck } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import { Avatar } from '@/components/common/SmartImage';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import StaffFormModal from '@/features/staff/StaffFormModal';
import StaffAccessModal from '@/features/staff/StaffAccessModal';
import StaffPasswordModal from '@/features/staff/StaffPasswordModal';
import { useGetStaffQuery, useUpdateStaffStatusMutation } from '@/redux/api/staffApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { fmtDateTime } from '@/lib/dates';

// backend User.status: active | disabled      User.dataScope: own | business
const STATUS_OPTIONS = [{ value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' }];
const SCOPE_OPTIONS = [{ value: 'own', label: 'Own records only' }, { value: 'business', label: 'All business records' }];

const StatusPill = ({ status }) => (
  <span className={`badge ${status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{status === 'active' ? 'Active' : 'Disabled'}</span>
);

export default function StaffPage() {
  const { params, setParams, reset, hasFilters, apiParams } = useListParams({});
  const { isAdmin } = useAuth();

  // GET /employees returns employees only (newest first); the cards use pagination totals of 1-row queries
  const { data, isLoading, isFetching, error, refetch } = useGetStaffQuery(apiParams);
  const all = useGetStaffQuery({ limit: 1 });
  const active = useGetStaffQuery({ status: 'active', limit: 1 });
  const disabled = useGetStaffQuery({ status: 'disabled', limit: 1 });

  const [form, setForm] = useState(null);
  const [access, setAccess] = useState(null);
  const [pwd, setPwd] = useState(null);
  const [toggle, setToggle] = useState(null);
  const [setStatus, { isLoading: changing }] = useUpdateStaffStatusMutation();

  const nextStatus = toggle?.status === 'active' ? 'disabled' : 'active';
  const confirmToggle = async () => {
    try {
      await setStatus({ id: toggle.id, status: nextStatus }).unwrap();
      toast.success(nextStatus === 'disabled' ? 'User disabled' : 'User activated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setToggle(null);
  };

  const cols = [
    {
      key: 'name',
      header: 'User',
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={s.photo} name={s.name} size={36} />
          <span>
            <b>{s.name}</b>
            <span className="block text-xs text-muted">{s.email}</span>
          </span>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (s) => s.phone || '-' },
    { key: 'dataScope', header: 'Sees', render: (s) => <span className="text-xs">{s.dataScope === 'business' ? 'All business records' : 'Own records only'}</span> },
    { key: 'permissions', header: 'Access', render: (s) => <span className="text-xs">{(s.permissions || []).length} permissions</span> },
    { key: 'lastLoginAt', header: 'Last Login', render: (s) => (s.lastLoginAt ? <span className="text-xs whitespace-nowrap">{fmtDateTime(s.lastLoginAt)}</span> : <span className="text-muted">Never</span>) },
    { key: 'status', header: 'Status', render: (s) => <StatusPill status={s.status} /> },
    {
      key: 'a',
      header: 'Action',
      render: (s) => (
        <TableActions
          actions={[
            { label: 'Edit', icon: Pencil, onClick: () => setForm(s), hidden: !isAdmin },
            { label: 'Access & Permissions', icon: ShieldCheck, onClick: () => setAccess(s), hidden: !isAdmin },
            { label: 'Reset Password', icon: KeyRound, onClick: () => setPwd(s), hidden: !isAdmin },
            s.status === 'active'
              ? { label: 'Disable', icon: Ban, danger: true, onClick: () => setToggle(s), hidden: !isAdmin }
              : { label: 'Activate', icon: CircleCheck, onClick: () => setToggle(s), hidden: !isAdmin },
          ]}
        />
      ),
    },
  ];

  return (
    <PermissionGuard perm="staff.view" page>
      <PageHeader
        title="Staff / Users"
        subtitle="Give each employee their own login and choose what they can see and do."
        actions={isAdmin && <button className="btn btn-primary" onClick={() => setForm({})}><Plus size={18} />Add User</button>}
      />
      <PageContainer>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} tone="blue" label="Total Employees" value={all.data?.total} loading={all.isLoading} />
          <StatCard icon={UserCheck} tone="green" label="Active" value={active.data?.total} loading={active.isLoading} />
          <StatCard icon={UserX} tone="orange" label="Disabled" value={disabled.data?.total} loading={disabled.isLoading} />
        </div>

        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchInput value={params.search || ''} onChange={(v) => setParams({ search: v })} placeholder="Name, email or phone…" />
          </div>
          <SelectFilter label="Status" value={params.status || ''} onChange={(v) => setParams({ status: v })} options={STATUS_OPTIONS} allLabel="All" />
          <SelectFilter label="Record Access" value={params.dataScope || ''} onChange={(v) => setParams({ dataScope: v })} options={SCOPE_OPTIONS} allLabel="All" />
        </FilterPanel>

        <SectionCard title="Employees">
          <DataTable
            columns={cols}
            data={data}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
            onPage={(p) => setParams({ page: p }, { keepPage: true })}
            onPageSize={(n) => setParams({ pageSize: n })}
            hasFilters={hasFilters}
            onReset={reset}
            noun="users"
            emptyTitle="No employees yet"
            emptyMessage="Add an employee to give them their own login."
          />
        </SectionCard>
      </PageContainer>

      <StaffFormModal open={!!form} person={form} onClose={() => setForm(null)} />
      <StaffAccessModal open={!!access} person={access} onClose={() => setAccess(null)} />
      <StaffPasswordModal open={!!pwd} person={pwd} onClose={() => setPwd(null)} />
      <ConfirmDialog
        open={!!toggle}
        danger={nextStatus === 'disabled'}
        title={nextStatus === 'disabled' ? 'Disable this user?' : 'Activate this user?'}
        message={
          nextStatus === 'disabled'
            ? `${toggle?.name} will be signed out everywhere and cannot log in until you activate them again.`
            : `${toggle?.name} will be able to log in again.`
        }
        confirmLabel={nextStatus === 'disabled' ? 'Disable User' : 'Activate User'}
        loading={changing}
        onConfirm={confirmToggle}
        onCancel={() => setToggle(null)}
      />
    </PermissionGuard>
  );
}