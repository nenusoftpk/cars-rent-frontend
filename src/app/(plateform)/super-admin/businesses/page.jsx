'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  Ban,
  CircleCheck,
} from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import SectionCard from '@/components/common/SectionCard';
import StatCard from '@/components/common/StatCard';
import StatusBadge from '@/components/common/StatusBadge';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import StatusFilter from '@/components/filters/StatusFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import NetworkError from '@/components/feedback/NetworkError';

import { useListParams } from '@/hooks/useListParams';
import { errorMessage } from '@/redux/api/baseApi';
import {
  useListPlatformBusinessesQuery,
  useSetBusinessStatusMutation,
} from '@/redux/api/platformApi';
import { fmtDate } from '@/lib/dates';

const BUSINESS_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

export default function PlatformBusinessesPage() {
  const { params, setParams, reset, hasFilters, apiParams } = useListParams({
    pageSize: 20,
    sort: 'createdAt:desc',
  });

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useListPlatformBusinessesQuery(apiParams);

  const [setStatus, { isLoading: updating }] = useSetBusinessStatusMutation();
  const [confirm, setConfirm] = useState(null);

  const handleStatusChange = async () => {
    if (!confirm) return;

    try {
      await setStatus({
        id: confirm.id,
        status: confirm.status,
      }).unwrap();

      toast.success(
        confirm.status === 'active'
          ? `"${confirm.name}" activated successfully`
          : `"${confirm.name}" suspended successfully`
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setConfirm(null);
    }
  };

  const items = data?.items || [];
  const total = data?.pagination?.total ?? data?.total ?? 0;

  const columns = [
    {
      key: 'businessName',
      header: 'Business Name',
      sortable: true,
      render: (b) => (
        <div className="min-w-0">
          <p className="font-semibold truncate">{b.businessName}</p>
          <p className="text-xs text-muted truncate">{b.email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: 'createdAt',
      header: 'Registered',
      sortable: true,
      render: (b) => (
        <span className="text-xs whitespace-nowrap">
          {b.createdAt ? fmtDate(b.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (b) => {
        const isActive = b.status === 'active';
        return (
          <TableActions
            actions={[
              {
                label: isActive ? 'Suspend Business' : 'Activate Business',
                icon: isActive ? Ban : CircleCheck,
                danger: isActive,
                onClick: () =>
                  setConfirm({
                    id: b.id || b._id,
                    name: b.businessName,
                    status: isActive ? 'suspended' : 'active',
                  }),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Businesses"
        subtitle="Manage all registered rental businesses on the platform."
        breadcrumb={[{ label: 'Businesses' }]}
      />

      <PageContainer>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <StatCard
            loading={isLoading}
            icon={Building2}
            tone="blue"
            label="Total Businesses"
            value={total}
            hint="All registered businesses"
          />
          <StatCard
            loading={isLoading}
            icon={CircleCheck}
            tone="green"
            label="Active (this page)"
            value={items.filter((b) => b.status === 'active').length}
          />
          <StatCard
            loading={isLoading}
            icon={Ban}
            tone="red"
            label="Suspended (this page)"
            value={items.filter((b) => b.status === 'suspended').length}
          />
        </div>

        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Search</label>
            <SearchInput
              value={params.search || ''}
              onChange={(v) => setParams({ search: v })}
              placeholder="Search by business name…"
            />
          </div>

          <StatusFilter
            label="Status"
            value={params.status || ''}
            onChange={(v) => setParams({ status: v })}
            options={BUSINESS_STATUSES}
          />
        </FilterPanel>

        <SectionCard title="All Businesses">
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
              noun="businesses"
              emptyTitle="No businesses found"
              emptyMessage="No businesses match your current filters."
            />
          )}
        </SectionCard>
      </PageContainer>

      <ConfirmDialog
        open={!!confirm}
        danger={confirm?.status === 'suspended'}
        title={
          confirm?.status === 'suspended'
            ? 'Suspend this business?'
            : 'Activate this business?'
        }
        message={
          confirm?.status === 'suspended'
            ? `"${confirm?.name}" will be suspended. Their staff will no longer be able to use the system.`
            : `"${confirm?.name}" will be activated again and regain full access.`
        }
        confirmLabel={
          confirm?.status === 'suspended' ? 'Suspend Business' : 'Activate Business'
        }
        loading={updating}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}