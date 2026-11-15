'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Users,
  CircleCheck,
  Ban,
  Pencil,
  KeyRound,
  Building2,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import SectionCard from '@/components/common/SectionCard';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import { Avatar } from '@/components/common/SmartImage';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import StatusFilter from '@/components/filters/StatusFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import NetworkError from '@/components/feedback/NetworkError';

import { useListParams } from '@/hooks/useListParams';
import { errorMessage } from '@/redux/api/baseApi';
import {
  useGetPlatformAdminsQuery,
  useUpdatePlatformAdminMutation,
  useSetPlatformAdminStatusMutation,
  useResetPlatformAdminPasswordMutation,
} from '@/redux/api/platformAdminApi';
import { useSetPlatformSubscriptionMutation } from '@/redux/api/platformApi';
import { fmtDate, fmtDateTime } from '@/lib/dates';

// ======================================================
// CONSTANTS
// ======================================================

const ADMIN_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

const PLAN_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'lifetime', label: 'Lifetime' },
];

const SUB_STATUS_OPTIONS = [
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
];

const PAYMENT_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
];

function pretty(v = '') {
  return String(v)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ======================================================
// PAGE
// ======================================================

export default function PlatformAdminsPage() {
  // ---------- List params ----------
  const {
    params,
    setParams,
    reset,
    hasFilters,
    apiParams,
  } = useListParams({
    pageSize: 20,
    sort: 'createdAt:desc',
  });

  // ---------- Auth ----------
  const {
    ready,
    isAuthenticated,
    isSuperAdmin,
    isPlatformEnabled,
  } = useAuth();

  const canFetchPlatformAdmins =
    ready && isAuthenticated && isSuperAdmin && isPlatformEnabled;

  // ---------- Queries & Mutations ----------
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetPlatformAdminsQuery(apiParams, {
    skip: !canFetchPlatformAdmins,
  });

  const [updateAdmin, { isLoading: updating }] =
    useUpdatePlatformAdminMutation();
  const [setStatus, { isLoading: statusLoading }] =
    useSetPlatformAdminStatusMutation();
  const [resetPassword, { isLoading: resetting }] =
    useResetPlatformAdminPasswordMutation();
  const [updateSub, { isLoading: subSaving }] =
    useSetPlatformSubscriptionMutation();

  // ---------- Local UI state ----------
  const [editItem, setEditItem] = useState(null);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [subEditItem, setSubEditItem] = useState(null);

  // ---------- Forms ----------
  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '', // optional – only sent if filled
    },
  });

  const subForm = useForm({
    defaultValues: {
      plan: 'trial',
      status: 'trialing',
      paymentStatus: 'unpaid',
      startDate: '',
      endDate: '',
      notes: '',
    },
  });

  // ======================================================
  // HANDLERS – ADMIN PROFILE
  // ======================================================

  const openEdit = (admin) => {
    setEditItem(admin);
    form.reset({
      name: admin.name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      password: '',
    });
  };

  const onEditSubmit = async (values) => {
    if (!editItem) return;

    const payload = {
      id: editItem.id || editItem._id,
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone?.trim() || '',
    };

    // Only send password if the user actually typed one
    if (values.password && values.password.trim().length >= 10) {
      payload.password = values.password.trim();
    }

    try {
      await updateAdmin(payload).unwrap();
      toast.success('Admin updated successfully');
      setEditItem(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // ======================================================
  // HANDLERS – STATUS
  // ======================================================

  const handleStatusChange = async () => {
    if (!confirmStatus) return;

    try {
      await setStatus({
        id: confirmStatus.id,
        status: confirmStatus.status,
      }).unwrap();

      toast.success(
        confirmStatus.status === 'active'
          ? `"${confirmStatus.name}" activated successfully`
          : `"${confirmStatus.name}" disabled successfully`
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setConfirmStatus(null);
    }
  };

  // ======================================================
  // HANDLERS – RESET PASSWORD
  // ======================================================

  const handleResetPassword = async () => {
    if (!confirmReset || !newPassword || newPassword.length < 10) {
      toast.error('Password must be at least 10 characters');
      return;
    }

    try {
      await resetPassword({
        id: confirmReset.id,
        newPassword,
      }).unwrap();

      toast.success(
        `Password reset for "${confirmReset.name}". All sessions revoked.`
      );
      setConfirmReset(null);
      setNewPassword('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // ======================================================
  // HANDLERS – SUBSCRIPTION (from Admins page)
  // ======================================================

  const openSubEdit = (admin) => {
    const sub = admin.subscription || {};
    setSubEditItem(admin);

    subForm.reset({
      plan: sub.plan || 'trial',
      status: sub.status || 'trialing',
      paymentStatus: sub.paymentStatus || 'unpaid',
      startDate: sub.startDate ? String(sub.startDate).slice(0, 10) : '',
      endDate: sub.endDate ? String(sub.endDate).slice(0, 10) : '',
      notes: sub.notes || '',
    });
  };

  const onSubSubmit = async (values) => {
    if (!subEditItem) return;

    const businessId =
      subEditItem.businessId ||
      subEditItem.business?.id ||
      subEditItem.business?._id;

    if (!businessId) {
      toast.error('This admin has no linked business.');
      return;
    }

    try {
      await updateSub({
        businessId,
        plan: values.plan,
        status: values.status,
        paymentStatus: values.paymentStatus,
        startDate: values.startDate || undefined,
        endDate:
          values.plan === 'lifetime' ? null : values.endDate || null,
        notes: values.notes || '',
      }).unwrap();

      toast.success('Subscription updated successfully');
      setSubEditItem(null);
      // list will auto-refresh via invalidatesTags
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // ======================================================
  // DATA
  // ======================================================

  const items = data?.items || [];
  const total = data?.pagination?.total ?? data?.total ?? 0;
  const activeCount = items.filter((a) => a.status === 'active').length;
  const disabledCount = items.filter((a) => a.status === 'disabled').length;

  // ======================================================
  // COLUMNS
  // ======================================================

  const columns = [
    {
      key: 'name',
      header: 'Admin',
      sortable: true,
      render: (a) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar src={a.photo} name={a.name} size={36} />
          <div className="min-w-0">
            <p className="font-semibold truncate">{a.name}</p>
            <p className="text-xs text-muted truncate">{a.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (a) => (
        <span className="text-sm">{a.phone || '—'}</span>
      ),
    },
    {
      key: 'business',
      header: 'Business',
      render: (a) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate flex items-center gap-1.5">
            <Building2 size={14} className="text-muted shrink-0" />
            {a.businessName || a.business?.businessName || '—'}
          </p>
          {(a.businessStatus || a.business?.status) && (
            <StatusBadge
              status={a.businessStatus || a.business?.status}
              className="mt-0.5"
            />
          )}
        </div>
      ),
    },
    {
      key: 'subscription',
      header: 'Subscription',
      render: (a) => {
        const sub = a.subscription;
        if (!sub) {
          return <span className="text-xs text-muted">No plan</span>;
        }
        return (
          <div className="min-w-0 space-y-0.5">
            <span className="badge badge-info text-xs">
              {pretty(sub.plan)}
            </span>
            <div>
              <StatusBadge status={sub.status} />
            </div>
            {sub.plan !== 'lifetime' && sub.endDate && (
              <p className="text-[11px] text-muted">
                Ends {fmtDate(sub.endDate)}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      render: (a) => (
        <span className="text-xs whitespace-nowrap">
          {a.lastLoginAt ? fmtDateTime(a.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      sortable: true,
      render: (a) => (
        <span className="text-xs whitespace-nowrap">
          {a.createdAt ? fmtDate(a.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (a) => {
        const isActive = a.status === 'active';
        const id = a.id || a._id;

        return (
          <TableActions
            actions={[
              {
                label: 'Edit Profile',
                icon: Pencil,
                onClick: () => openEdit(a),
              },
              {
                label: 'Edit Subscription',
                icon: CreditCard,
                onClick: () => openSubEdit(a),
              },
              {
                label: 'Reset Password',
                icon: KeyRound,
                onClick: () => {
                  setNewPassword('');
                  setConfirmReset({ id, name: a.name });
                },
              },
              {
                label: isActive ? 'Disable Admin' : 'Activate Admin',
                icon: isActive ? Ban : CircleCheck,
                danger: isActive,
                onClick: () =>
                  setConfirmStatus({
                    id,
                    name: a.name,
                    status: isActive ? 'disabled' : 'active',
                  }),
              },
            ]}
          />
        );
      },
    },
  ];

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <>
      <PageHeader
        title="Admins"
        subtitle="View and manage all business administrators and their subscriptions."
        breadcrumb={[{ label: 'Admins' }]}
      />

      <PageContainer>
        {/* Stats */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <StatCard
            loading={isLoading}
            icon={Users}
            tone="blue"
            label="Total Admins"
            value={total}
            hint="All business administrators"
          />
          <StatCard
            loading={isLoading}
            icon={CircleCheck}
            tone="green"
            label="Active (this page)"
            value={activeCount}
          />
          <StatCard
            loading={isLoading}
            icon={Ban}
            tone="red"
            label="Disabled (this page)"
            value={disabledCount}
          />
        </div>

        {/* Filters */}
        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Search</label>
            <SearchInput
              value={params.search || ''}
              onChange={(v) => setParams({ search: v })}
              placeholder="Search by name, email or phone…"
            />
          </div>

          <StatusFilter
            label="Status"
            value={params.status || ''}
            onChange={(v) => setParams({ status: v })}
            options={ADMIN_STATUSES}
          />
        </FilterPanel>

        {/* Table */}
        <SectionCard title="All Admins">
          {error ? (
            <NetworkError error={error} onRetry={refetch} />
          ) : (
            <DataTable
              columns={columns}
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
              noun="admins"
              emptyTitle="No admins found"
              emptyMessage="No business administrators match your current filters."
            />
          )}
        </SectionCard>
      </PageContainer>

      {/* ==================================================
          EDIT PROFILE MODAL
          ================================================== */}
      <AppModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit Admin Profile"
        size="md"
      >
        <Form form={form} onSubmit={onEditSubmit} className="space-y-4">
          <div className="rounded-xl bg-soft border border-line p-3 text-sm">
            <p className="font-semibold">{editItem?.name}</p>
            <p className="text-muted">{editItem?.email}</p>
            <p className="text-xs text-muted mt-1">
              Business:{' '}
              {editItem?.businessName ||
                editItem?.business?.businessName ||
                '—'}
            </p>
            {editItem?.subscription && (
              <p className="text-xs text-muted mt-0.5">
                Plan: {pretty(editItem.subscription.plan)} (
                {editItem.subscription.status})
              </p>
            )}
          </div>

          <FormInput
            name="name"
            label="Full Name"
            required
            placeholder="Admin full name"
          />

          <FormInput
            name="email"
            label="Email"
            type="email"
            required
            placeholder="admin@example.com"
          />

          <FormInput
            name="phone"
            label="Phone Number"
            placeholder="03xx-xxxxxxx"
          />

          <FormInput
            name="password"
            label="New Password (optional)"
            type="password"
            placeholder="Leave blank to keep current password"
            autoComplete="new-password"
          />
          <p className="text-xs text-muted -mt-2">
            Minimum 10 characters. Changing the password will revoke all
            active sessions.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => setEditItem(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={updating}
            >
              {updating ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Form>
      </AppModal>

      {/* ==================================================
          EDIT SUBSCRIPTION MODAL (from Admins page)
          ================================================== */}
      <AppModal
        open={!!subEditItem}
        onClose={() => setSubEditItem(null)}
        title="Edit Subscription"
        size="md"
      >
        <Form form={subForm} onSubmit={onSubSubmit} className="space-y-4">
          <div className="rounded-xl bg-soft border border-line p-3 text-sm">
            <p className="font-semibold">
              {subEditItem?.businessName ||
                subEditItem?.business?.businessName ||
                '—'}
            </p>
            <p className="text-muted text-xs">
              Admin: {subEditItem?.name} ({subEditItem?.email})
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <FormSelect
              name="plan"
              label="Plan"
              required
              options={PLAN_OPTIONS}
              placeholder={null}
            />
            <FormSelect
              name="status"
              label="Status"
              required
              options={SUB_STATUS_OPTIONS}
              placeholder={null}
            />
            <FormSelect
              name="paymentStatus"
              label="Payment Status"
              required
              options={PAYMENT_OPTIONS}
              placeholder={null}
            />
            <FormDatePicker name="startDate" label="Start Date" />
            <FormDatePicker name="endDate" label="End Date" />
          </div>

          <FormInput
            name="notes"
            as="textarea"
            label="Notes"
            placeholder="Optional internal notes…"
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => setSubEditItem(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={subSaving}
            >
              {subSaving ? 'Saving…' : 'Save Subscription'}
            </button>
          </div>
        </Form>
      </AppModal>

      {/* ==================================================
          DISABLE / ACTIVATE CONFIRM
          ================================================== */}
      <ConfirmDialog
        open={!!confirmStatus}
        danger={confirmStatus?.status === 'disabled'}
        title={
          confirmStatus?.status === 'disabled'
            ? 'Disable this admin?'
            : 'Activate this admin?'
        }
        message={
          confirmStatus?.status === 'disabled'
            ? `"${confirmStatus?.name}" will be disabled. They will no longer be able to log in and all active sessions will be revoked.`
            : `"${confirmStatus?.name}" will be activated again and regain access.`
        }
        confirmLabel={
          confirmStatus?.status === 'disabled'
            ? 'Disable Admin'
            : 'Activate Admin'
        }
        loading={statusLoading}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirmStatus(null)}
      />

      {/* ==================================================
          RESET PASSWORD MODAL
          ================================================== */}
      <AppModal
        open={!!confirmReset}
        onClose={() => {
          setConfirmReset(null);
          setNewPassword('');
        }}
        title="Reset Admin Password"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Set a new password for{' '}
            <b className="text-foreground">{confirmReset?.name}</b>.
            All of their existing sessions will be revoked immediately.
          </p>

          <div>
            <label className="label" htmlFor="new-password">
              New Password <span className="text-danger">*</span>
            </label>
            <input
              id="new-password"
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 10 characters"
              minLength={10}
              autoComplete="new-password"
            />
            {newPassword && newPassword.length < 10 && (
              <p className="field-error">
                Password must be at least 10 characters
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => {
                setConfirmReset(null);
                setNewPassword('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={resetting || newPassword.length < 10}
              onClick={handleResetPassword}
            >
              {resetting ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </div>
      </AppModal>
    </>
  );
}