'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import {
  Bell,
  AlertTriangle,
  CalendarClock,
  CircleCheck,
  Car,
  Shield,
  FileText,
  Wrench,
  Droplets,
  Check,
  Undo2,
} from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import Tabs from '@/components/common/Tabs';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import DataTable from '@/components/tables/DataTable';

import {
  useGetRemindersQuery,
  useCompleteReminderMutation,
  useReopenReminderMutation,
} from '@/redux/api/systemApi'; // or '@/redux/api/dashboardApi' if you keep them separate

import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { fmtDateTime } from '@/lib/dates';
import { errorMessage } from '@/redux/api/baseApi';

/* ------------------------------------------------------------------ */
/*  Exact labels returned by backend FRONTEND_TYPE_MAP                */
/* ------------------------------------------------------------------ */
const TYPES = [
  'Car Return',
  'Overdue Car',
  'Insurance Expiry',
  'Token Tax Expiry',
  'Car Document Expiry',
  'Car Servicing',
  'Oil Change',
];

const ICON = {
  'Car Return': Car,
  'Overdue Car': AlertTriangle,
  'Insurance Expiry': Shield,
  'Token Tax Expiry': FileText,
  'Car Document Expiry': FileText,
  'Car Servicing': Wrench,
  'Oil Change': Droplets,
};

const TONE = {
  Overdue: ['bg-danger/10 text-danger', 'badge-danger'],
  Today: ['bg-warning/15 text-orange-600', 'badge-warning'],
  Upcoming: ['bg-primary/10 text-primary', 'badge-info'],
  Completed: ['bg-success/10 text-success', 'badge-success'],
};

const VIEW_TABS = [
  { value: 'Today', label: 'Today' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Overdue', label: 'Overdue' },
  { value: 'Completed', label: 'Completed' },
];

export default function RemindersPage() {
  const { can } = useAuth();

  const {
    params,
    setParams,
    reset,
    hasFilters,
    apiParams,
  } = useListParams({ view: 'Today' });

  // Backend expects: view, search, type, page, pageSize (or limit)
  const { data, isLoading, isFetching, error, refetch } = useGetRemindersQuery(apiParams);

  const [completeReminder] = useCompleteReminderMutation();
  const [reopenReminder] = useReopenReminderMutation();

  // Backend returns: { items, summary, counts, pagination, daysBefore, timeZone }
  const summary = data?.summary ?? {
    Today: 0,
    Upcoming: 0,
    Overdue: 0,
    Completed: 0,
  };

  const handleAction = async (mutation, id, successMsg) => {
    try {
      await mutation(id).unwrap();
      toast.success(successMsg);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const columns = [
    {
      key: 'type',
      header: 'Reminder',
      render: (row) => {
        const Icon = ICON[row.type] || Bell;
        const [iconTone] = TONE[row.view] || TONE.Upcoming;

        return (
          <div className="flex items-center gap-3">
            <span className={`grid place-items-center size-9 rounded-lg ${iconTone}`}>
              <Icon size={17} />
            </span>
            <b>{row.type}</b>
          </div>
        );
      },
    },
    {
      key: 'details',
      header: 'Details',
      render: (row) => (
        <span className="text-sm text-heading/90">{row.details || '—'}</span>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      sortable: true,
      render: (row) => (
        <span className="whitespace-nowrap">
          {row.due ? fmtDateTime(row.due) : '—'}
        </span>
      ),
    },
    {
      key: 'view',
      header: 'Urgency',
      render: (row) => {
        const [, badgeClass] = TONE[row.view] || TONE.Upcoming;
        return <span className={`badge ${badgeClass}`}>{row.view}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.link && (
            <Link href={row.link} className="btn btn-neutral btn-sm">
              Open
            </Link>
          )}

          {can('reminders:edit') && (
            row.completed ? (
              <button
                type="button"
                className="btn btn-neutral btn-sm"
                onClick={() =>
                  handleAction(reopenReminder, row.id, 'Reminder reopened')
                }
              >
                <Undo2 size={14} />
                Reopen
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() =>
                  handleAction(completeReminder, row.id, 'Marked as done')
                }
              >
                <Check size={14} />
                Done
              </button>
            )
          )}
        </div>
      ),
    },
  ];

  return (
    <PermissionGuard perm="reminders.view" page>
      <PageHeader
        title="Reminders"
        subtitle="Cars due back, late cars, insurance, token tax, servicing and oil changes."
      />

      <PageContainer>
        {/* Tabs – counts come from backend summary */}
        <div className="card px-3 pt-2">
          <Tabs
            value={params.view || 'Today'}
            onChange={(value) => setParams({ view: value })}
            tabs={VIEW_TABS.map((tab) => ({
              value: tab.value,
              label: tab.label,
              count: summary[tab.value] ?? 0,
            }))}
          />
        </div>

        {/* Filters */}
        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchInput
              value={params.search || ''}
              onChange={(value) => setParams({ search: value })}
              placeholder="Car, customer or reminder…"
            />
          </div>

          <SelectFilter
            label="Type"
            value={params.type || ''}
            onChange={(value) => setParams({ type: value })}
            options={TYPES}
            allLabel="All Types"
          />
        </FilterPanel>

        {/* Table */}
        <SectionCard title={`${params.view || 'Today'} Reminders`}>
          <DataTable
            columns={columns}
            data={data}                       // expects { items, pagination }
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
            sort="due:asc"
            onPage={(page) => setParams({ page }, { keepPage: true })}
            onPageSize={(pageSize) => setParams({ pageSize })}
            hasFilters={hasFilters}
            onReset={reset}
            noun="reminders"
            emptyTitle={`No ${(params.view || 'Today').toLowerCase()} reminders`}
            emptyMessage="Everything is under control."
          />
        </SectionCard>
      </PageContainer>
    </PermissionGuard>
  );
}

export const _r = [CalendarClock, CircleCheck];