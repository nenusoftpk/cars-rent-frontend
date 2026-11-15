'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  CreditCard,
  Clock,
  CircleCheck,
  AlertTriangle,
  Ban,
} from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import SectionCard from '@/components/common/SectionCard';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import StatusFilter from '@/components/filters/StatusFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import NetworkError from '@/components/feedback/NetworkError';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormSelect from '@/components/forms/FormSelect';
import FormInput from '@/components/forms/FormInput';
import FormDatePicker from '@/components/forms/FormDatePicker';

import { useForm } from 'react-hook-form';
import { useListParams } from '@/hooks/useListParams';
import { errorMessage } from '@/redux/api/baseApi';
import {
  useListPlatformSubscriptionsQuery,
  useSetPlatformSubscriptionMutation,
} from '@/redux/api/platformApi';
import { fmtDate } from '@/lib/dates';

const PLAN_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'lifetime', label: 'Lifetime' },
];

const STATUS_OPTIONS = [
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
  return String(v).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlatformSubscriptionsPage() {
  const { params, setParams, reset, hasFilters, apiParams } = useListParams({
    pageSize: 20,
  });

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useListPlatformSubscriptionsQuery(apiParams);

  const [updateSub, { isLoading: saving }] = useSetPlatformSubscriptionMutation();

  const [editItem, setEditItem] = useState(null);

  const form = useForm({
    defaultValues: {
      plan: 'trial',
      status: 'trialing',
      paymentStatus: 'unpaid',
      startDate: '',
      endDate: '',
      notes: '',
    },
  });

  const openEdit = (row) => {
    const sub = row.subscription || row;
    setEditItem(row);
    form.reset({
      plan: sub.plan || 'trial',
      status: sub.status || 'trialing',
      paymentStatus: sub.paymentStatus || 'unpaid',
      startDate: sub.startDate ? sub.startDate.slice(0, 10) : '',
      endDate: sub.endDate ? sub.endDate.slice(0, 10) : '',
      notes: sub.notes || '',
    });
  };

  const onSubmit = async (values) => {
    if (!editItem) return;

    const businessId =
      editItem.businessId ||
      editItem.business?.id ||
      editItem.business?._id ||
      editItem.id;

    try {
      await updateSub({
        businessId,
        ...values,
        endDate: values.plan === 'lifetime' ? null : values.endDate || null,
      }).unwrap();

      toast.success('Subscription updated successfully');
      setEditItem(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const items = data?.items || [];

  const columns = [
    {
      key: 'business',
      header: 'Business',
      render: (r) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">
            {r.business?.businessName || r.businessName || '—'}
          </p>
          <p className="text-xs text-muted truncate">
            {r.business?.email || r.email || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (r) => {
        const plan = r.subscription?.plan || r.plan;
        return <span className="badge badge-info">{pretty(plan)}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const status = r.subscription?.status || r.status;
        return <StatusBadge status={status} />;
      },
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (r) => {
        const pay = r.subscription?.paymentStatus || r.paymentStatus;
        return (
          <span
            className={`badge ${
              pay === 'paid' ? 'badge-success' : 'badge-warning'
            }`}
          >
            {pretty(pay)}
          </span>
        );
      },
    },
    {
      key: 'daysRemaining',
      header: 'Days Left',
      render: (r) => {
        const sub = r.subscription || r;
        if (sub.plan === 'lifetime' || sub.isLifetime) {
          return <span className="text-success font-semibold">Lifetime</span>;
        }
        const days = sub.daysRemaining;
        if (days == null) return '—';
        return (
          <span className={days <= 3 ? 'text-danger font-semibold' : ''}>
            {days} day{days === 1 ? '' : 's'}
          </span>
        );
      },
    },
    {
      key: 'endDate',
      header: 'Ends On',
      render: (r) => {
        const end = r.subscription?.endDate || r.endDate;
        return (
          <span className="text-xs whitespace-nowrap">
            {end ? fmtDate(end) : '—'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => (
        <TableActions
          actions={[
            {
              label: 'Edit Subscription',
              icon: CreditCard,
              onClick: () => openEdit(r),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="View and manage subscription plans of all businesses."
        breadcrumb={[{ label: 'Subscriptions' }]}
      />

      <PageContainer>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            loading={isLoading}
            icon={CreditCard}
            tone="blue"
            label="Total Subscriptions"
            value={items.length}
          />
          <StatCard
            loading={isLoading}
            icon={CircleCheck}
            tone="green"
            label="Active"
            value={items.filter((r) => (r.subscription?.status || r.status) === 'active').length}
          />
          <StatCard
            loading={isLoading}
            icon={Clock}
            tone="orange"
            label="Trialing"
            value={items.filter((r) => (r.subscription?.status || r.status) === 'trialing').length}
          />
          <StatCard
            loading={isLoading}
            icon={AlertTriangle}
            tone="red"
            label="Expired / Suspended"
            value={items.filter((r) =>
              ['expired', 'suspended'].includes(r.subscription?.status || r.status)
            ).length}
          />
        </div>

        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Search</label>
            <SearchInput
              value={params.search || ''}
              onChange={(v) => setParams({ search: v })}
              placeholder="Business name…"
            />
          </div>

          <SelectFilter
            label="Plan"
            value={params.plan || ''}
            onChange={(v) => setParams({ plan: v })}
            options={PLAN_OPTIONS}
            allLabel="All Plans"
          />

          <StatusFilter
            label="Status"
            value={params.status || ''}
            onChange={(v) => setParams({ status: v })}
            options={STATUS_OPTIONS}
          />
        </FilterPanel>

        <SectionCard title="All Subscriptions">
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
              onPage={(p) => setParams({ page: p }, { keepPage: true })}
              onPageSize={(n) => setParams({ pageSize: n })}
              hasFilters={hasFilters}
              onReset={reset}
              noun="subscriptions"
              emptyTitle="No subscriptions found"
              emptyMessage="No subscriptions match your filters."
            />
          )}
        </SectionCard>
      </PageContainer>

      {/* Edit Subscription Modal */}
      <AppModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit Subscription"
        size="md"
      >
        <Form form={form} onSubmit={onSubmit} className="space-y-4">
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
              options={STATUS_OPTIONS}
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
              onClick={() => setEditItem(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Form>
      </AppModal>
    </>
  );
}