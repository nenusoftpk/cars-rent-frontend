// PATH: src/app/customer-ledger/page.jsx   (REPLACE your existing Customer Ledger page - the Customers page links here as /customer-ledger?customerId=...)
'use client';
import Link from 'next/link';
import { BookOpen, FileText, HandCoins, Scale, Wallet, UserRound } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import { Avatar } from '@/components/common/SmartImage';
import FilterPanel from '@/components/filters/FilterPanel';
import DateRangeFilter from '@/components/filters/DateRangeFilter';
import DataTable from '@/components/tables/DataTable';
import ExportButtons from '@/components/tables/ExportButtons';
import CustomerSelector from '@/components/forms/CustomerSelector';
import { useGetLedgerQuery, ledgerApi } from '@/redux/api/ledgerApi';
import { useGetCustomerQuery } from '@/redux/api/customerApi';
import { unwrap } from '@/redux/api/bookingApi';
import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { formatPKR } from '@/lib/money';
import { fmtDate } from '@/lib/dates';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const typeTone = (t = '') => {
  const s = t.toLowerCase();
  if (s.includes('refund')) return 'warning';
  if (s.includes('payment') || s.includes('receipt') || s.includes('advance') || s.includes('credit')) return 'success';
  if (s.includes('opening')) return 'neutral';
  return 'info'; // booking / invoice / debit
};
const prettyType = (t = '') => t.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const dashIfZero = (n) => (num(n) ? formatPKR(n) : '-');

export default function CustomerLedgerPage() {
  const { params, setParams, hasFilters, apiParams } = useListParams({});
  const customerId = params.customerId || '';

  const { data, isLoading, isFetching, error, refetch } = useGetLedgerQuery(apiParams, { skip: !customerId });
  const cq = useGetCustomerQuery(customerId, { skip: !customerId });
  const exportAll = useExportAll(ledgerApi.endpoints.getLedger, apiParams);

  // customer comes with the ledger when the backend sends it, otherwise from GET /customers/:id
  const fetched = unwrap(cq.data);
  const customer = data?.customer || fetched?.customer || fetched || null;
  const sm = data?.summary;
  const closing = sm?.closingBalance ?? 0;

  const cols = [
    { key: 'date', header: 'Date', render: (r) => <span className="whitespace-nowrap">{r.date ? fmtDate(r.date) : '-'}</span> },
    { key: 'type', header: 'Type', render: (r) => (r.type ? <span className={`badge badge-${typeTone(r.type)}`}>{prettyType(r.type)}</span> : '-') },
    {
      key: 'reference',
      header: 'Reference',
      render: (r) =>
        r.bookingId && r.reference ? (
          <Link href={`/bookings/${r.bookingId}`} className="text-primary font-semibold">{r.reference}</Link>
        ) : (
          r.reference || '-'
        ),
    },
    { key: 'description', header: 'Description', render: (r) => <span className="text-xs">{r.description || '-'}</span> },
    { key: 'debit', header: 'Billed (Debit)', align: 'right', render: (r) => <span className={r.debit ? 'font-semibold' : 'text-muted'}>{dashIfZero(r.debit)}</span> },
    { key: 'credit', header: 'Received (Credit)', align: 'right', render: (r) => <span className={r.credit ? 'text-success font-semibold' : 'text-muted'}>{dashIfZero(r.credit)}</span> },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (r) => (r.balance === null || r.balance === undefined ? '-' : <b className={r.balance > 0 ? 'text-danger' : 'text-success'}>{formatPKR(r.balance)}</b>),
    },
  ];

  const expCols = [
    { header: 'Date', value: (r) => (r.date ? fmtDate(r.date) : '') },
    { header: 'Type', value: (r) => prettyType(r.type) },
    { header: 'Reference', value: (r) => r.reference },
    { header: 'Description', value: (r) => r.description },
    { header: 'Billed', value: (r) => formatPKR(r.debit), right: true },
    { header: 'Received', value: (r) => formatPKR(r.credit), right: true },
    { header: 'Balance', value: (r) => (r.balance == null ? '' : formatPKR(r.balance)), right: true },
  ];

  return (
    <PermissionGuard perm="ledger.view" page>
      <PageHeader title="Customer Ledger (Khata)" subtitle="Every bill, payment and refund for one customer, with the running balance." />
      <PageContainer>
        <FilterPanel onReset={() => setParams({ from: '', to: '' })} cols="sm:grid-cols-2 lg:grid-cols-3">
          <CustomerSelector
            label="Customer"
            value={customerId}
            onChange={(v) => setParams({ customerId: v })}
            placeholder="Select a customer"
            params={{ status: '' }}
          />
          <DateRangeFilter from={params.from || ''} to={params.to || ''} onChange={(p) => setParams(p)} />
        </FilterPanel>

        {!customerId ? (
          <div className="card card-pad text-center py-14">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen size={26} /></div>
            <h3 className="text-lg font-bold">Select a customer</h3>
            <p className="text-sm text-muted mt-1">Choose a customer above to see their full khata.</p>
          </div>
        ) : (
          <>
            {customer && (
              <div className="card card-pad flex flex-wrap items-center gap-4">
                <Avatar src={customer.photo} name={customer.name} size={56} />
                <div className="flex-1 min-w-[200px]">
                  <h3 className="text-lg font-extrabold leading-tight">{customer.name}</h3>
                  <p className="text-sm text-muted">
                    {[customer.phone, customer.cnic, customer.city].filter(Boolean).join(' · ') || '-'}
                  </p>
                </div>
                {customer.type && <span className="badge badge-purple">{customer.type}</span>}
                {customer.status && <span className={`badge ${customer.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{prettyType(customer.status)}</span>}
              </div>
            )}

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={UserRound} tone="sky" label="Opening Balance" value={formatPKR(sm?.openingBalance ?? customer?.openingBalance ?? 0)} loading={isLoading} hint="Before first booking" />
              <StatCard icon={FileText} tone="blue" label="Total Billed" value={formatPKR(sm?.totalDebit ?? 0)} loading={isLoading} />
              <StatCard icon={Wallet} tone="green" label="Total Received" value={formatPKR(sm?.totalCredit ?? 0)} loading={isLoading} />
              <StatCard
                icon={closing > 0 ? HandCoins : Scale}
                tone={closing > 0 ? 'red' : 'green'}
                label={closing > 0 ? 'Balance Due' : closing < 0 ? 'Advance / Credit' : 'Settled'}
                value={formatPKR(Math.abs(closing))}
                loading={isLoading}
                hint={closing > 0 ? 'Customer owes you' : closing < 0 ? 'You owe the customer' : 'Nothing pending'}
              />
            </div>

            <SectionCard
              title="Ledger Entries"
              actions={<ExportButtons module="ledger" columns={expCols} loadRows={exportAll} title="Customer Ledger" subtitle={customer?.name || ''} filename="customer-ledger" />}
            >
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
                onReset={() => setParams({ from: '', to: '' })}
                noun="entries"
                emptyTitle="No entries yet"
                emptyMessage="Bills and payments for this customer will appear here."
              />
            </SectionCard>
          </>
        )}
      </PageContainer>
    </PermissionGuard>
  );
}