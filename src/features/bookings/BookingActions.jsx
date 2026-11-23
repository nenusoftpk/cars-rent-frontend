'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Eye,
  Pencil,
  XCircle,
  CalendarClock,
  KeyRound,
  Undo2,
  Printer,
  Receipt,
  HandCoins,
  FileText,
} from 'lucide-react';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import AppModal from '@/components/modals/AppModal';
import { useCancelBookingMutation, useExtendBookingMutation } from '@/redux/api/bookingApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useAuth } from '@/hooks/useAuth';
import { printHtml, bookingDoc, invoiceDoc } from '@/lib/printTemplates';
import { splitDT, joinDT, fmtDateTime } from '@/lib/dates';
import { TIME_SLOTS } from '@/lib/dates';
import { useRentalAgreementPrint } from './useRentalAgreementPrint';

// Shared by the All Bookings table and the booking detail page.
export function useBookingActions() {
  const router = useRouter();
  const { can } = useAuth();
  const [cancel, setCancel] = useState(null);
  const [extend, setExtend] = useState(null);
  const { startPrintAgreement, biometricDialog, printing } = useRentalAgreementPrint();

  const menu = (b, { onView } = {}) => {
    const open = ['Reserved', 'On Rent'].includes(b.status); // can be extended
    const editable = b.status === 'Reserved'; // the server only edits reserved bookings
    return [
      onView && { label: 'View Details', icon: Eye, onClick: () => onView(b) },
      {
        label: 'Edit Booking',
        icon: Pencil,
        onClick: () => router.push(`/bookings/new?edit=${b.id}`),
        hidden: !editable || !can('bookings:edit'),
      },
      {
        label: 'Extend Booking',
        icon: CalendarClock,
        onClick: () => setExtend(b),
        hidden: !open || !can('bookings:edit'),
      },
      {
        label: 'Issue Car',
        icon: KeyRound,
        onClick: () =>
          router.push(`/car-issue-return?mode=issue&bookingId=${b.id}`),
        hidden: b.status !== 'Reserved' || !can('issue:create'),
      },
      {
        label: 'Return Car',
        icon: Undo2,
        onClick: () =>
          router.push(`/car-issue-return?mode=return&bookingId=${b.id}`),
        hidden: b.status !== 'On Rent' || !can('issue:create'),
      },
      {
        label: 'Receive Payment',
        icon: HandCoins,
        onClick: () => router.push(`/billing?pay=${b.id}`),
        hidden:
          b.status === 'Cancelled' || b.balance <= 0 || !can('billing:create'),
      },
      // Full one-page agreement (customer + car + biometric) — same as New Booking print
      {
        label: printing ? 'Preparing…' : 'Print Agreement',
        icon: FileText,
        onClick: () => startPrintAgreement(b),
        hidden: b.status === 'Cancelled' || !can('bookings:print'),
      },
      {
        label: 'Print Confirmation',
        icon: Printer,
        onClick: () => printHtml(bookingDoc(b), b.number),
        hidden: !can('bookings:print'),
      },
      {
        label: 'Print Bill',
        icon: Receipt,
        onClick: () => printHtml(invoiceDoc(b), b.invoiceNo),
        hidden: b.status === 'Cancelled' || !can('bookings:print'),
      },
      {
        label: 'Cancel Booking',
        icon: XCircle,
        danger: true,
        onClick: () => setCancel(b),
        hidden: b.status !== 'Reserved' || !can('bookings:edit'),
      },
    ].filter(Boolean);
  };

  const dialogs = (
    <>
      <CancelDialog booking={cancel} onClose={() => setCancel(null)} />
      <ExtendDialog booking={extend} onClose={() => setExtend(null)} />
      {biometricDialog}
    </>
  );

  return { menu, dialogs, startPrintAgreement };
}

function CancelDialog({ booking, onClose }) {
  const [run, { isLoading }] = useCancelBookingMutation();
  const [reason, setReason] = useState('');
  const go = async () => {
    try {
      await run({
        id: booking.id,
        reason: reason || 'Cancelled by staff',
      }).unwrap();
      toast.success('Booking cancelled');
      setReason('');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      onClose();
    }
  };
  return (
    <ConfirmDialog
      open={!!booking}
      danger
      title="Cancel this booking?"
      message={`${booking?.number} - ${booking?.customerName}, ${booking?.carName}. The car will become free for these dates.`}
      confirmLabel="Yes, Cancel Booking"
      cancelLabel="Keep Booking"
      loading={isLoading}
      onConfirm={go}
      onCancel={onClose}
    >
      <label className="block">
        <span className="label">Reason (optional)</span>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Customer changed plan"
        />
      </label>
      {(booking?.paid > 0 || booking?.depositHeld > 0) && (
        <p className="text-xs text-danger">
          Money is still held on this booking (
          {`Rs. ${((booking.paid || 0) + (booking.depositHeld || 0)).toLocaleString('en-US')}`}
          ). Give it back first from Billing &amp; Payments, then cancel.
        </p>
      )}
    </ConfirmDialog>
  );
}

function ExtendDialog({ booking, onClose }) {
  const [run, { isLoading }] = useExtendBookingMutation();
  const init = booking
    ? splitDT(booking.returnAt)
    : { date: '', time: '10:00' };
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const d = date || init.date;
  const t = time || init.time;
  const go = async () => {
    try {
      await run({ id: booking.id, returnAt: joinDT(d, t) }).unwrap();
      toast.success('Booking extended successfully');
      setDate('');
      setTime('');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <AppModal
      open={!!booking}
      onClose={onClose}
      size="sm"
      title="Extend Booking"
      subtitle={
        booking
          ? `${booking.number} · now returns ${fmtDateTime(booking.returnAt)}`
          : ''
      }
      footer={
        <>
          <button className="btn btn-neutral" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={go}
            disabled={isLoading}
          >
            {isLoading ? 'Saving…' : 'Extend Booking'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_130px] gap-2">
        <label>
          <span className="label">New Return Date</span>
          <input
            type="date"
            className="input"
            value={d}
            min={init.date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          <span className="label">Time</span>
          <select
            className="input"
            value={t}
            onChange={(e) => setTime(e.target.value)}
          >
            {TIME_SLOTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted mt-3">
        The rent is recalculated automatically. We also check that no other
        booking is in the way.
      </p>
    </AppModal>
  );
}
