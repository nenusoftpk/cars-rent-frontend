'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Phone, MapPin, Pencil, Printer, CalendarPlus, BookOpen, Lock, Mail, Users } from 'lucide-react';
import DetailDrawer from '@/components/modals/DetailDrawer';
import Tabs from '@/components/common/Tabs';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage, { Avatar } from '@/components/common/SmartImage';
import NetworkError from '@/components/feedback/NetworkError';
import { useGetCustomerQuery } from '@/redux/api/customerApi';
import { useAuth } from '@/hooks/useAuth';
import { formatPKR } from '@/lib/money';
import { fmtDate } from '@/lib/dates';
import { printHtml, customerDoc } from '@/lib/printTemplates';

const Info = ({ label, children }) => (
  <div className="rounded-lg bg-soft border border-line px-3 py-2">
    <p className="text-[11px] text-muted">{label}</p>
    <p className="text-sm font-semibold break-words">{children || '-'}</p>
  </div>
);

const SectionTitle = ({ children }) => (
  <h4 className="text-sm font-extrabold">{children}</h4>
);

// One document image. Click opens the full-size image in a new tab.
function DocImage({ label, url, locked }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="rounded-xl border border-line overflow-hidden bg-card">
      <div className="aspect-[16/10] bg-soft grid place-items-center">
        {url && !failed ? (
          <a href={url} target="_blank" rel="noreferrer" title="Open full size" className="block size-full">
            <img
              src={url}
              alt={label}
              loading="lazy"
              className="size-full object-cover"
              onError={() => setFailed(true)}
            />
          </a>
        ) : locked ? (
          <span className="text-xs text-muted flex flex-col items-center gap-1 px-2 text-center">
            <Lock size={18} />Hidden - no permission
          </span>
        ) : (
          <span className="text-xs text-muted px-2 text-center">
            {failed ? 'Image could not be loaded' : 'Not uploaded'}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold px-3 py-2">{label}</p>
    </div>
  );
}

function GuarantorCard({ n, g }) {
  return (
    <div className="rounded-xl border border-line p-3 sm:p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-primary" />
        <h4 className="text-sm font-extrabold">Guarantor {n}</h4>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <Info label="Full Name">{g.name}</Info>
        <Info label="Mobile Number">{g.mobile}</Info>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DocImage key={`p-${g.photo}`} label="Guarantor Photo" url={g.photo} locked={g.locked} />
        <DocImage key={`f-${g.cnicFront}`} label="CNIC Front" url={g.cnicFront} locked={g.locked} />
        <DocImage key={`b-${g.cnicBack}`} label="CNIC Back" url={g.cnicBack} locked={g.locked} />
      </div>
    </div>
  );
}

export default function CustomerDrawer({ id, onClose, onEdit }) {
  const [tab, setTab] = useState('details');
  const { can } = useAuth();
  const { data: c, isLoading, error, refetch } = useGetCustomerQuery(id, { skip: !id });

  const docs = c
    ? [
        ['Customer Photo', c.photo],
        ['CNIC Front', c.cnicFront],
        ['CNIC Back', c.cnicBack],
        ['Driving Licence', c.licenseImage],
      ]
    : [];

  const guarantors = c
    ? [1, 2].map((n) => ({ n, g: c[`guarantor${n}`] })).filter((x) => x.g?.enabled)
    : [];

  const fullAddress = c ? [c.address, c.city].filter(Boolean).join(', ') : '';
  const cap = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');

  return (
    <DetailDrawer
      open={!!id}
      onClose={() => { setTab('details'); onClose(); }}
      title="Customer Details"
      width="max-w-2xl"
      footer={c && (
        <>
          {can('customers:print') && (
            <button className="btn btn-outline" onClick={() => printHtml(customerDoc(c, can('sensitive:view')), 'Customer')}>
              <Printer size={16} />Print Customer Details
            </button>
          )}
          {can('ledger:view') && (
            <Link href={`/customer-ledger?customerId=${c.id}`} className="btn btn-neutral">
              <BookOpen size={16} />Open Khata
            </Link>
          )}
          {can('bookings:create') && (
            <Link href={`/bookings/new?customerId=${c.id}`} className="btn btn-primary ml-auto">
              <CalendarPlus size={16} />New Booking for This Customer
            </Link>
          )}
        </>
      )}
    >
      {isLoading ? (
        <div className="space-y-3"><div className="skeleton h-24" /><div className="skeleton h-40" /></div>
      ) : error ? (
        <NetworkError error={error} onRetry={refetch} />
      ) : c && (
        <div className="space-y-5">
          {/* ---------- Header ---------- */}
          <div className="flex gap-4 items-center">
            <Avatar src={c.photo} name={c.name} size={76} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-extrabold">{c.name}</h3>
                {c.type && <StatusBadge status={c.type} />}
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm text-muted flex items-center gap-1.5 mt-1"><Phone size={14} />{c.mobile}</p>
              <p className="text-sm text-muted flex items-center gap-1.5"><MapPin size={14} />{fullAddress}</p>
            </div>
            {can('customers:edit') && (
              <button className="btn btn-neutral btn-sm self-start" onClick={() => onEdit(c)}>
                <Pencil size={14} />Edit
              </button>
            )}
          </div>

          {/* ---------- Totals ---------- */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">Total Bookings</p><p className="text-xl font-extrabold">{c.totalBookings}</p></div>
            <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">Total Spent</p><p className="text-lg font-extrabold text-success">{formatPKR(c.totalSpent)}</p></div>
            <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">Remaining Balance</p><p className={`text-lg font-extrabold ${c.pending > 0 ? 'text-danger' : ''}`}>{formatPKR(c.pending)}</p></div>
          </div>

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'details', label: 'Details' },
              { value: 'guarantors', label: 'Guarantors', count: guarantors.length },
              { value: 'history', label: 'Booking History', count: c.bookings.length },
              { value: 'payments', label: 'Payments', count: c.payments.length },
            ]}
          />

          {/* ---------- Details: all info + all customer documents ---------- */}
          {tab === 'details' && (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-2">
                <Info label="Full Name">{c.name}</Info>
                <Info label="Customer Code">{c.customerCode}</Info>
                <Info label="Mobile Number">{c.mobile}</Info>
                <Info label="Alternate Phone">{c.alternatePhone}</Info>
                <Info label="CNIC Number">
                  {c.locked ? <span className="flex items-center gap-1 text-muted"><Lock size={13} />{c.cnic}</span> : c.cnic}
                </Info>
                <Info label="Email">
                  {c.email ? <span className="flex items-center gap-1"><Mail size={13} />{c.email}</span> : ''}
                </Info>
                <Info label="Gender">{cap(c.gender)}</Info>
                <Info label="Customer Type">{c.type}</Info>
                <Info label="Driving Licence No">{c.licenseNo}</Info>
                <Info label="Licence Expiry">{c.licenseExpiry ? fmtDate(c.licenseExpiry) : ''}</Info>
                <div className="sm:col-span-2"><Info label="Address">{fullAddress}</Info></div>
                {c.openingBalance !== undefined && c.openingBalance !== null && (
                  <Info label="Opening Balance">{formatPKR(c.openingBalance)}</Info>
                )}
                <Info label="Customer Since">{fmtDate(c.createdAt)}</Info>
                {c.notes ? <div className="sm:col-span-2"><Info label="Notes">{c.notes}</Info></div> : null}
              </div>

              <div className="space-y-2">
                <SectionTitle>Customer Documents</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  {docs.map(([label, url]) => (
                    <DocImage key={`${label}-${url}`} label={label} url={url} locked={c.locked} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------- Guarantors ---------- */}
          {tab === 'guarantors' && (
            guarantors.length ? (
              <div className="space-y-4">
                {guarantors.map(({ n, g }) => <GuarantorCard key={n} n={n} g={g} />)}
              </div>
            ) : (
              <p className="text-sm text-muted py-6 text-center">No guarantor added.</p>
            )
          )}

          {/* ---------- Booking history ---------- */}
          {tab === 'history' && (c.bookings.length ? (
            <ul className="divide-y divide-line">
              {c.bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 py-2.5 hover:bg-soft rounded-lg px-1">
                    <SmartImage src={b.carImage} alt="" width={56} height={34} className="rounded-md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{b.carName} <span className="text-muted font-normal">· {b.number}</span></p>
                      <p className="text-xs text-muted">{fmtDate(b.pickupAt)} - {fmtDate(b.returnAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatPKR(b.total)}</p>
                      <StatusBadge status={b.displayStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted py-6 text-center">No bookings yet.</p>)}

          {/* ---------- Payments ---------- */}
          {tab === 'payments' && (c.payments.length ? (
            <ul className="divide-y divide-line">
              {c.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.type}</p>
                    <p className="text-xs text-muted">{fmtDate(p.date)} · {p.method} · {p.receiptNo}</p>
                  </div>
                  <p className={`font-bold ${['Deposit Refund', 'Advance Refund'].includes(p.type) ? 'text-danger' : 'text-success'}`}>{formatPKR(p.amount)}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted py-6 text-center">No payments yet.</p>)}
        </div>
      )}
    </DetailDrawer>
  );
}