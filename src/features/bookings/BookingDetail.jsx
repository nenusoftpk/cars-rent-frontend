'use client';
import Link from 'next/link';
import {
  Phone,
  Printer,
  Receipt,
  KeyRound,
  Undo2,
  HandCoins,
  ClipboardList,
  FileText,
} from 'lucide-react';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage, { Avatar } from '@/components/common/SmartImage';
import { useAuth } from '@/hooks/useAuth';
import { formatPKR, formatNum } from '@/lib/money';
import { fmtDateTime, fmtDate } from '@/lib/dates';
import {
  printHtml,
  bookingDoc,
  invoiceDoc,
  handoverDoc,
  returnDoc,
  receiptDoc,
} from '@/lib/printTemplates';
import { useRentalAgreementPrint } from './useRentalAgreementPrint';

const Row = ({ k, v, strong }) => (
  <div className="flex justify-between gap-3 py-1.5 text-sm">
    <span className="text-muted">{k}</span>
    <span className={strong ? 'font-extrabold' : 'font-semibold text-right'}>
      {v || '-'}
    </span>
  </div>
);

// Used inside the drawer and on /bookings/[id]
export default function BookingDetail({ b }) {
  const { can } = useAuth();
  const { startPrintAgreement, biometricDialog, printing } =
    useRentalAgreementPrint();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 items-center rounded-2xl bg-soft border border-line p-3">
        <SmartImage
          src={b.carImage}
          alt={b.carName}
          width={150}
          height={90}
          className="w-32 h-auto"
        />
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-extrabold">{b.number}</h3>
            <StatusBadge status={b.displayStatus} />
          </div>
          <p className="font-semibold">
            {b.carName}{' '}
            <span className="text-muted font-normal">· {b.carPlate}</span>
          </p>
          <p className="text-xs text-muted">
            Invoice {b.invoiceNo} · Booked {fmtDate(b.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Avatar src={b.customerPhoto} name={b.customerName} size={44} />
          <div className="text-sm">
            <b>{b.customerName}</b>
            <p className="text-xs text-muted flex items-center gap-1">
              <Phone size={11} />
              {b.customerMobile}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        {can('bookings:print') && b.status !== 'Cancelled' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => startPrintAgreement(b)}
            disabled={printing}
          >
            <FileText size={15} />
            {printing ? 'Preparing…' : 'Print Agreement'}
          </button>
        )}
        {can('bookings:print') && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => printHtml(bookingDoc(b), b.number)}
          >
            <Printer size={15} />
            Print Confirmation
          </button>
        )}
        {can('bookings:print') && b.status !== 'Cancelled' && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => printHtml(invoiceDoc(b), b.invoiceNo)}
          >
            <Receipt size={15} />
            Print Bill
          </button>
        )}
        {b.issue && can('issue:print') && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => printHtml(handoverDoc(b), 'Handover')}
          >
            <ClipboardList size={15} />
            Handover Form
          </button>
        )}
        {b.returnInfo && can('issue:print') && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => printHtml(returnDoc(b), 'Return')}
          >
            <ClipboardList size={15} />
            Return Form
          </button>
        )}
        {b.status === 'Reserved' && can('issue:create') && (
          <Link
            className="btn btn-primary btn-sm"
            href={`/car-issue-return?mode=issue&bookingId=${b.id}`}
          >
            <KeyRound size={15} />
            Issue Car
          </Link>
        )}
        {b.status === 'On Rent' && can('issue:create') && (
          <Link
            className="btn btn-primary btn-sm"
            href={`/car-issue-return?mode=return&bookingId=${b.id}`}
          >
            <Undo2 size={15} />
            Return Car
          </Link>
        )}
        {b.status !== 'Cancelled' &&
          b.balance > 0 &&
          can('billing:create') && (
            <Link className="btn btn-success btn-sm" href={`/billing?pay=${b.id}`}>
              <HandCoins size={15} />
              Receive Payment
            </Link>
          )}
      </div>

      <div className="grid md:grid-cols-2 gap-x-8">
        <div>
          <h4 className="font-bold mb-1">Rental</h4>
          <Row k="Pick up" v={fmtDateTime(b.pickupAt)} />
          <Row k="Return" v={fmtDateTime(b.returnAt)} />
          <Row k="Pick up place" v={b.pickupLocation} />
          <Row k="Return place" v={b.returnLocation} />
          <Row k="Driver" v={b.driverName || 'Not required'} />
          <Row k="Handled by" v={b.staffName} />
          {b.instructions && <Row k="Instructions" v={b.instructions} />}
        </div>
        <div>
          <h4 className="font-bold mb-1">Bill</h4>
          <Row
            k={`Rent (${b.days} ${b.rateType === 'hourly' ? 'hours' : 'days'} × ${formatPKR(b.rate)})`}
            v={formatPKR(b.rentAmount)}
          />
          {b.charges.map((c, i) => (
            <Row key={i} k={c.label} v={formatPKR(c.amount)} />
          ))}
          <div className="border-t border-line mt-1 pt-1">
            <Row k="Total Bill" v={formatPKR(b.total)} strong />
            <Row k="Amount Received" v={formatPKR(b.paid)} />
            <Row
              k="Remaining Balance"
              v={
                <span
                  className={b.balance > 0 ? 'text-danger' : 'text-success'}
                >
                  {formatPKR(b.balance)}
                </span>
              }
              strong
            />
          </div>
          {b.depositPaid > 0 && (
            <div className="mt-2 rounded-xl bg-warning/10 border border-warning/30 px-3 py-2 text-sm">
              <b>Security deposit</b> (separate, refundable)
              <br />
              Received {formatPKR(b.depositPaid)} · Refunded{' '}
              {formatPKR(b.depositRefunded)} · Used{' '}
              {formatPKR(b.depositAdjusted)} ·{' '}
              <b>Held {formatPKR(b.depositHeld)}</b>
            </div>
          )}
        </div>
      </div>

      {(b.issue || b.returnInfo) && (
        <div>
          <h4 className="font-bold mb-2">Car Condition - Before and After</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-line p-3 text-sm">
              <p className="font-semibold text-primary mb-1">When issued</p>
              {b.issue ? (
                <>
                  <p>
                    {fmtDateTime(b.issue.at)} · by {b.issue.staffName}
                  </p>
                  <p>
                    Meter: <b>{formatNum(b.issue.meter)} km</b> · Fuel:{' '}
                    <b>{b.issue.fuel}</b>
                  </p>
                  <p className="text-muted">
                    Damage: {b.issue.damage || 'None'}
                  </p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {b.issue.photos.map((u, i) => (
                      <SmartImage
                        key={i}
                        src={u}
                        alt="Condition photo"
                        width={64}
                        height={44}
                        className="rounded border border-line"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-muted">Not issued yet.</p>
              )}
            </div>
            <div className="rounded-xl border border-line p-3 text-sm">
              <p className="font-semibold text-primary mb-1">When returned</p>
              {b.returnInfo ? (
                <>
                  <p>
                    {fmtDateTime(b.returnInfo.at)} · by{' '}
                    {b.returnInfo.staffName}
                  </p>
                  <p>
                    Meter: <b>{formatNum(b.returnInfo.meter)} km</b> · Fuel:{' '}
                    <b>{b.returnInfo.fuel}</b>
                  </p>
                  <p className="text-muted">
                    New damage: {b.returnInfo.damage || 'None'}
                  </p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {b.returnInfo.photos.map((u, i) => (
                      <SmartImage
                        key={i}
                        src={u}
                        alt="Return photo"
                        width={64}
                        height={44}
                        className="rounded border border-line"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-muted">Not returned yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {b.payments && (
        <div>
          <h4 className="font-bold mb-2">Payment History</h4>
          {b.payments.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {b.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{p.type}</p>
                    <p className="text-xs text-muted">
                      {fmtDateTime(p.date)} · {p.method} · {p.receiptNo}
                    </p>
                  </div>
                  <b
                    className={
                      ['Deposit Refund', 'Advance Refund'].includes(p.type)
                        ? 'text-danger'
                        : 'text-success'
                    }
                  >
                    {formatPKR(p.amount)}
                  </b>
                  {can('billing:print') && (
                    <button
                      className="btn btn-ghost btn-sm !px-2"
                      aria-label={`Print receipt ${p.receiptNo}`}
                      onClick={() =>
                        printHtml(receiptDoc(p, b), p.receiptNo)
                      }
                    >
                      <Printer size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No payments yet.</p>
          )}
        </div>
      )}

      <div>
        <h4 className="font-bold mb-2">Booking History</h4>
        <ol className="relative border-l-2 border-line ml-2 space-y-3">
          {[...b.history].reverse().map((h, i) => (
            <li key={i} className="pl-4 relative">
              <span className="absolute -left-[7px] top-1.5 size-3 rounded-full bg-primary" />
              <p className="text-sm font-medium">{h.text}</p>
              <p className="text-xs text-muted">{fmtDateTime(h.at)}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Biometric choice modal for Print Agreement */}
      {biometricDialog}
    </div>
  );
}
