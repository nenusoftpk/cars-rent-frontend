// PATH: src/app/billing/page.jsx   (REPLACE your existing Billing & Payments page)
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { HandCoins, Printer, Eye, Receipt, ArrowLeftRight, Wallet, FileText, Landmark, Paperclip } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import StatCard from '@/components/common/StatCard';
import Tabs from '@/components/common/Tabs';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage from '@/components/common/SmartImage';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import DateRangeFilter from '@/components/filters/DateRangeFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ExportButtons from '@/components/tables/ExportButtons';
import CustomerSelector from '@/components/forms/CustomerSelector';
import PaymentModal from '@/features/payments/PaymentModal';
import { useGetInvoicesQuery, useGetPaymentsQuery, useGetDepositsQuery, useGetPaymentStatsQuery, paymentApi } from '@/redux/api/paymentApi';
import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { useAuth } from '@/hooks/useAuth';
import { PAYMENT_METHODS, PAYMENT_TYPES, METHOD_ICON } from '@/constants';
import { formatPKR } from '@/lib/money';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { printHtml, invoiceDoc, receiptDoc } from '@/lib/printTemplates';

const DEFAULTS = { tab: 'invoices' };
const REFUND_TYPES = ['Deposit Refund', 'Advance Refund'];
// Payment.status enum: completed | void  (GET /payments reads `status`)
const PAYMENT_STATUS = [{ value: 'completed', label: 'Completed' }, { value: 'void', label: 'Voided' }];
const FILTER_KEYS = { search: '', from: '', to: '', paymentStatus: '', method: '', type: '', status: '', customerId: '', state: '' };
const TITLES = { invoices: 'Bills', payments: 'Payment History', deposits: 'Security Deposits' };

const Method = ({ m }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
    <SmartImage src={METHOD_ICON[m]} alt="" width={20} height={20} className="rounded" />
    {m}
  </span>
);

export default function BillingPage() {
  const { params, setParams, reset, hasFilters, apiParams } = useListParams(DEFAULTS);
  const { can } = useAuth();
  const tab = params.tab;
  const [pay, setPay] = useState(null);

  const inv = useGetInvoicesQuery(apiParams, { skip: tab !== 'invoices' });
  const pm = useGetPaymentsQuery(apiParams, { skip: tab !== 'payments' });
  const dp = useGetDepositsQuery(apiParams, { skip: tab !== 'deposits' });
  const q = { invoices: inv, payments: pm, deposits: dp }[tab];

  // payment-history cards come from GET /payments/stats; the other two tabs are summed from their rows
  const stats = useGetPaymentStatsQuery({ from: params.from, to: params.to }, { skip: tab !== 'payments' });
  const sm = tab === 'payments' ? stats.data : q.data?.summary;
  const sl = tab === 'payments' ? stats.isLoading : q.isLoading;

  const ep = { invoices: paymentApi.endpoints.getInvoices, payments: paymentApi.endpoints.getPayments, deposits: paymentApi.endpoints.getDeposits }[tab];
  const exportAll = useExportAll(ep, apiParams);

  const payId = params.pay;
  const modalOpen = !!pay || !!payId;
  const close = () => {
    setPay(null);
    if (payId) setParams({ pay: '' }, { keepPage: true });
  };
  const resetFilters = () => setParams(FILTER_KEYS);

  // NOTE: no column here is `sortable` on purpose. GET /payments only reads
  // page, limit, search, from, to, bookingId, type, method, status - and Bills / Deposits are built
  // from /bookings rows - so a server-side sort would silently do nothing.
  const invCols = [
    { key: 'invoiceNo', header: 'Invoice No', render: (b) => <b className="text-primary">{b.invoiceNo}</b> },
    { key: 'createdAt', header: 'Date', render: (b) => fmtDate(b.createdAt) },
    { key: 'customerName', header: 'Customer' },
    { key: 'carName', header: 'Car', render: (b) => `${b.carName} (${b.carPlate})` },
    { key: 'total', header: 'Total Bill', align: 'right', render: (b) => formatPKR(b.total) },
    { key: 'paid', header: 'Amount Received', align: 'right', render: (b) => <span className="text-success font-semibold">{formatPKR(b.paid)}</span> },
    { key: 'balance', header: 'Remaining Balance', align: 'right', render: (b) => <span className={b.balance > 0 ? 'text-danger font-semibold' : ''}>{formatPKR(b.balance)}</span> },
    { key: 'paymentStatus', header: 'Status', render: (b) => <StatusBadge status={b.paymentStatus} /> },
    {
      key: 'a',
      header: 'Action',
      render: (b) => (
        <TableActions
          actions={[
            { label: 'Receive Payment', icon: HandCoins, onClick: () => setPay({ id: b.id }), hidden: b.balance <= 0 || !can('billing:create') },
            { label: 'Print Bill', icon: Printer, onClick: () => printHtml(invoiceDoc(b), b.invoiceNo), hidden: !can('billing:print') },
            { label: 'View Booking', icon: Eye, onClick: () => window.open(`/bookings/${b.id}`, '_self') },
          ]}
        />
      ),
    },
  ];

  const isVoid = (p) => p.status === 'void';
  const proofOf = (p) => p.paymentProof ?? p.proof ?? '';
  const payCols = [
    { key: 'receiptNo', header: 'Receipt No', render: (p) => <b className={isVoid(p) ? 'text-muted line-through' : 'text-primary'}>{p.receiptNo}</b> },
    { key: 'date', header: 'Payment Date', render: (p) => fmtDateTime(p.date) },
    { key: 'customerName', header: 'Customer' },
    { key: 'bookingNumber', header: 'Booking', render: (p) => <Link href={`/bookings/${p.bookingId}`} className="text-primary">{p.bookingNumber}</Link> },
    {
      key: 'type',
      header: 'Type',
      render: (p) => <StatusBadge status={p.type} tone={REFUND_TYPES.includes(p.type) ? 'danger' : p.type === 'Security Deposit' ? 'warning' : 'success'} />,
    },
    { key: 'method', header: 'Method', render: (p) => <Method m={p.method} /> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => (
        <b className={isVoid(p) ? 'text-muted line-through' : REFUND_TYPES.includes(p.type) ? 'text-danger' : 'text-success'}>{formatPKR(p.amount)}</b>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => (isVoid(p) ? <span className="badge badge-danger">Void</span> : <span className="badge badge-success">Completed</span>) },
    { key: 'receivedByName', header: 'Received By' },
    {
      key: 'a',
      header: 'Action',
      render: (p) => (
        <TableActions
          actions={[
            { label: 'Print Receipt', icon: Printer, onClick: () => printHtml(receiptDoc(p), p.receiptNo), hidden: !can('billing:print') || isVoid(p) },
            { label: 'View Payment Proof', icon: Paperclip, onClick: () => window.open(proofOf(p), '_blank', 'noopener'), hidden: !proofOf(p) },
          ]}
        />
      ),
    },
  ];

  const depCols = [
    { key: 'number', header: 'Booking', render: (b) => <Link href={`/bookings/${b.id}`} className="text-primary font-bold">{b.number}</Link> },
    { key: 'customerName', header: 'Customer' },
    { key: 'carName', header: 'Car', render: (b) => `${b.carName} (${b.carPlate})` },
    { key: 'status', header: 'Booking Status', render: (b) => <StatusBadge status={b.displayStatus} /> },
    { key: 'depositPaid', header: 'Deposit Received', align: 'right', render: (b) => formatPKR(b.depositPaid) },
    { key: 'depositAdjusted', header: 'Used For Bill', align: 'right', render: (b) => formatPKR(b.depositAdjusted) },
    { key: 'depositRefunded', header: 'Refunded', align: 'right', render: (b) => formatPKR(b.depositRefunded) },
    { key: 'depositHeld', header: 'Still Held', align: 'right', render: (b) => <b className={b.depositHeld > 0 ? 'text-orange-600' : ''}>{formatPKR(b.depositHeld)}</b> },
    {
      key: 'a',
      header: 'Action',
      render: (b) => <TableActions actions={[{ label: 'Refund Deposit', icon: ArrowLeftRight, onClick: () => setPay({ id: b.id, refund: true }), hidden: b.depositHeld <= 0 || !can('billing:create') }]} />,
    },
  ];

  const cols = { invoices: invCols, payments: payCols, deposits: depCols }[tab];
  const expCols = {
    invoices: [
      { header: 'Invoice', value: (r) => r.invoiceNo },
      { header: 'Date', value: (r) => fmtDate(r.createdAt) },
      { header: 'Customer', value: (r) => r.customerName },
      { header: 'Total Bill', value: (r) => formatPKR(r.total), right: true },
      { header: 'Received', value: (r) => formatPKR(r.paid), right: true },
      { header: 'Balance', value: (r) => formatPKR(r.balance), right: true },
      { header: 'Status', value: (r) => r.paymentStatus },
    ],
    payments: [
      { header: 'Receipt', value: (r) => r.receiptNo },
      { header: 'Date', value: (r) => fmtDateTime(r.date) },
      { header: 'Customer', value: (r) => r.customerName },
      { header: 'Booking', value: (r) => r.bookingNumber },
      { header: 'Type', value: (r) => r.type },
      { header: 'Method', value: (r) => r.method },
      { header: 'Status', value: (r) => (r.status === 'void' ? 'Void' : 'Completed') },
      { header: 'Amount', value: (r) => formatPKR(r.amount), right: true },
    ],
    deposits: [
      { header: 'Booking', value: (r) => r.number },
      { header: 'Customer', value: (r) => r.customerName },
      { header: 'Received', value: (r) => formatPKR(r.depositPaid), right: true },
      { header: 'Refunded', value: (r) => formatPKR(r.depositRefunded), right: true },
      { header: 'Held', value: (r) => formatPKR(r.depositHeld), right: true },
    ],
  }[tab];

  return (
    <PermissionGuard perm="billing.view" page>
      <PageHeader
        title="Billing & Payments"
        subtitle="Bills, receipts, advance and balance payments and security deposits."
        actions={
          <PermissionGuard perm="billing.create">
            <button className="btn btn-success" onClick={() => setPay({})}><HandCoins size={18} />Receive Payment</button>
          </PermissionGuard>
        }
      />
      <PageContainer>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {tab === 'invoices' && (
            <>
              <StatCard icon={FileText} tone="blue" label="Invoices" value={sm?.count} loading={sl} hint="In this list" />
              <StatCard icon={Receipt} tone="sky" label="Total Billed" value={formatPKR(sm?.billed)} loading={sl} />
              <StatCard icon={Wallet} tone="green" label="Amount Received" value={formatPKR(sm?.received)} loading={sl} />
              <StatCard icon={HandCoins} tone="orange" label="Remaining To Receive" value={formatPKR(sm?.pending)} loading={sl} />
            </>
          )}
          {tab === 'payments' && (
            <>
              <StatCard icon={Wallet} tone="green" label="Rent Received" value={formatPKR(sm?.received)} loading={sl} hint="Without deposits" />
              <StatCard icon={Receipt} tone="blue" label="Receipts" value={sm?.count} loading={sl} />
              <StatCard icon={Landmark} tone="orange" label="Deposits Received" value={formatPKR(sm?.depositsIn)} loading={sl} hint="Refundable" />
              <StatCard icon={ArrowLeftRight} tone="red" label="Deposits Returned" value={formatPKR(sm?.depositsOut)} loading={sl} />
            </>
          )}
          {tab === 'deposits' && (
            <>
              <StatCard icon={Landmark} tone="orange" label="Deposits Held Now" value={formatPKR(sm?.held)} loading={sl} hint="Not income - refundable" />
              <StatCard icon={FileText} tone="blue" label="Bookings With Deposit Held" value={sm?.count} loading={sl} />
            </>
          )}
        </div>

        <div className="card px-3 pt-2">
          <Tabs
            value={tab}
            onChange={(t) => { reset(); setTimeout(() => setParams({ tab: t }), 0); }}
            tabs={[{ value: 'invoices', label: 'Bills (Invoices)' }, { value: 'payments', label: 'Payment History' }, { value: 'deposits', label: 'Security Deposits' }]}
          />
        </div>

        <FilterPanel onReset={resetFilters} cols="sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchInput value={params.search || ''} onChange={(v) => setParams({ search: v })} placeholder={tab === 'payments' ? 'Receipt no, customer or booking…' : 'Invoice, booking or customer…'} />
          </div>
          {tab !== 'deposits' && (
            <DateRangeFilter
              from={params.from || ''}
              to={params.to || ''}
              onChange={(p) => setParams(p)}
              fromLabel={tab === 'payments' ? 'Payment Date - From' : 'Bill Date - From'}
              toLabel={tab === 'payments' ? 'Payment Date - To' : 'Bill Date - To'}
            />
          )}
          {tab === 'invoices' && <SelectFilter label="Payment Status" value={params.paymentStatus || ''} onChange={(v) => setParams({ paymentStatus: v })} options={['Paid', 'Partial', 'Unpaid']} allLabel="All" />}
          {tab === 'payments' && (
            <>
              <SelectFilter label="Payment Method" value={params.method || ''} onChange={(v) => setParams({ method: v })} options={PAYMENT_METHODS} allLabel="All Methods" />
              <SelectFilter label="Payment Type" value={params.type || ''} onChange={(v) => setParams({ type: v })} options={PAYMENT_TYPES} allLabel="All Types" />
              <SelectFilter label="Receipt Status" value={params.status || ''} onChange={(v) => setParams({ status: v })} options={PAYMENT_STATUS} allLabel="All" />
            </>
          )}
          {tab === 'deposits' && (
            <SelectFilter
              label="Deposit"
              value={params.state || ''}
              onChange={(v) => setParams({ state: v })}
              options={[{ value: 'held', label: 'Still held' }, { value: 'returned', label: 'Fully returned / used' }]}
              allLabel="All"
            />
          )}
          {tab !== 'payments' && <CustomerSelector label="Customer" value={params.customerId || ''} onChange={(v) => setParams({ customerId: v })} placeholder="All Customers" params={{ status: '' }} />}
        </FilterPanel>

        <SectionCard
          title={TITLES[tab]}
          actions={<ExportButtons module="billing" columns={expCols} loadRows={exportAll} title={TITLES[tab]} subtitle={params.from ? `${params.from} to ${params.to || 'today'}` : ''} />}
        >
          <DataTable
            key={tab}
            columns={cols}
            data={q.data}
            isLoading={q.isLoading}
            isFetching={q.isFetching}
            error={q.error}
            onRetry={q.refetch}
            onPage={(p) => setParams({ page: p }, { keepPage: true })}
            onPageSize={(n) => setParams({ pageSize: n })}
            hasFilters={hasFilters}
            onReset={resetFilters}
            noun="records"
            emptyTitle="Nothing here yet"
            emptyMessage="Bills and payments appear here after you make bookings."
          />
        </SectionCard>
      </PageContainer>

      <PaymentModal open={modalOpen} bookingId={pay?.id || payId || ''} mode={pay?.refund ? 'refund' : 'payment'} onClose={close} />
    </PermissionGuard>
  );
}