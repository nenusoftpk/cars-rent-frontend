'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { KeyRound, Undo2, Printer, CircleCheck, TriangleAlert } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import Tabs from '@/components/common/Tabs';
import SmartImage, { Avatar } from '@/components/common/SmartImage';
import EmptyState from '@/components/common/EmptyState';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import FormTimePicker from '@/components/forms/FormTimePicker';
import FormPhotoUpload from '@/components/forms/FormPhotoUpload';
import MoneyInput from '@/components/forms/MoneyInput';
import PaymentMethodPicker from '@/features/bookings/PaymentMethodPicker';
import { issueSchema, returnSchema } from '@/validations';
import { FUEL_LEVELS } from '@/constants';
import { useGetBookingsQuery, useGetBookingQuery } from '@/redux/api/bookingApi';
import { useIssueCarMutation, useReturnCarMutation } from '@/redux/api/carInspectionApi';
import { useGetStaffQuery } from '@/redux/api/staffApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { calcReturn } from '@/lib/pricing';
import { formatPKR, formatNum } from '@/lib/money';
import { fmtDateTime, toDay, joinDT } from '@/lib/dates';
import { printHtml, handoverDoc, returnDoc } from '@/lib/printTemplates';
import { format } from 'date-fns';

const FUEL = FUEL_LEVELS.map((f) => ({ value: f, label: f }));

// Defaults used by calcReturn until a real settings endpoint exists
const DEFAULT_SETTINGS = {
  graceHours: 1,
  kmLimitPerDay: 0,
  extraKmRate: 0,
};

const finish = (b, r, key, status) => ({
  ...b,
  ...(r?.booking ? r.booking : { status, displayStatus: status }),
  ...(r?.total != null ? { total: r.total, balance: Math.max(r.total - (b?.paid || 0), 0) } : {}),
  [key]: r?.inspection || r?.booking?.[key] || b?.[key],
});

function BookingPick({ mode, value, onChange }) {
  const { data, isLoading } = useGetBookingsQuery({
    view: mode === 'issue' ? 'reserved' : 'active',
    pageSize: 100,
    sort: 'pickupAt:asc',
  });

  return (
    <div className="max-w-xl">
      <label className="label" htmlFor="bk-pick">
        {mode === 'issue' ? 'Select booking to hand over' : 'Select active rental to take back'}{' '}
        <span className="text-danger">*</span>
      </label>
      <select
        id="bk-pick"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      >
        <option value="">
          {isLoading ? 'Loading…' : data?.items?.length ? 'Choose a booking…' : 'No bookings available'}
        </option>
        {data?.items?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.number} - {b.customerName} - {b.carName} ({b.carPlate})
            {b.isOverdue ? ' - OVERDUE' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function BookingCard({ b }) {
  return (
    <div className="rounded-2xl bg-soft border border-line p-3 grid sm:grid-cols-[auto_1fr_1fr] gap-4 items-center">
      <SmartImage src={b.carImage} alt={b.carName} width={150} height={90} className="w-32 h-auto" />
      <div>
        <p className="font-extrabold">
          {b.carName} <span className="text-muted font-medium">· {b.carPlate}</span>
        </p>
        <p className="text-xs text-muted">{b.number}</p>
        <p className="text-xs mt-1">
          Pick up: <b>{fmtDateTime(b.pickupAt)}</b>
        </p>
        <p className={`text-xs ${b.isOverdue ? 'text-danger' : ''}`}>
          Due back: <b>{fmtDateTime(b.returnAt)}</b>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Avatar src={b.customerPhoto} name={b.customerName} size={44} />
        <div>
          <b>{b.customerName}</b>
          <p className="text-xs text-muted">{b.customerMobile}</p>
          <p className="text-xs">
            Balance:{' '}
            <b className={b.balance > 0 ? 'text-danger' : 'text-success'}>{formatPKR(b.balance)}</b>
          </p>
        </div>
      </div>
    </div>
  );
}

function Done({ b, kind, onAgain }) {
  return (
    <SectionCard>
      <EmptyState
        icon={CircleCheck}
        title={kind === 'issue' ? 'Car issued successfully' : 'Car returned successfully'}
        message={`${b.number} · ${b.customerName} · ${b.carName} (${b.carPlate})`}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button
              className="btn btn-primary"
              onClick={() => printHtml(kind === 'issue' ? handoverDoc(b) : returnDoc(b), b.number)}
            >
              <Printer size={16} />
              {kind === 'issue' ? 'Print Handover Form' : 'Print Return Form'}
            </button>
            <Link href={`/bookings/${b.id}`} className="btn btn-neutral">
              View Booking
            </Link>
            <button className="btn btn-outline" onClick={onAgain}>
              {kind === 'issue' ? 'Issue Another Car' : 'Return Another Car'}
            </button>
          </div>
        }
      />
    </SectionCard>
  );
}

function IssuePanel({ bookingId, setBookingId }) {
  const { user } = useAuth();
  const { data: b } = useGetBookingQuery(bookingId, { skip: !bookingId });

  const {
    data: staff,
    isLoading: staffLoading,
    isError: staffError,
  } = useGetStaffQuery({
    status: 'active',
    pageSize: 100,
  });

  const [issue, { isLoading }] = useIssueCarMutation();
  const [done, setDone] = useState(null);

  const form = useForm({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      bookingId,
      meter: '',
      fuel: 'Full',
      damage: '',
      staffId: user?.id || '',
      photos: [],
    },
  });

  useEffect(() => {
    form.setValue('bookingId', bookingId);
    if (b) form.setValue('meter', b.car?.odometer ?? '');
  }, [bookingId, b]); // eslint-disable-line react-hooks/exhaustive-deps

  if (done) {
    return (
      <Done
        b={done}
        kind="issue"
        onAgain={() => {
          setDone(null);
          setBookingId('');
          form.reset();
        }}
      />
    );
  }

  const submit = async (v) => {
    try {
      const r = await issue({
        bookingId,
        meter: v.meter,
        fuel: v.fuel,
        damage: v.damage,
        condition: v.damage?.trim() ? 'fair' : 'good',
        photos: v.photos,
      }).unwrap();
      toast.success('Car issued successfully');
      setDone(finish(b, r, 'issue', 'On Rent'));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <SectionCard title="1. Select Booking">
        <BookingPick mode="issue" value={bookingId} onChange={setBookingId} />
        {form.formState.errors.bookingId && (
          <p className="field-error">{form.formState.errors.bookingId.message}</p>
        )}
      </SectionCard>

      {b && (
        <Form form={form} onSubmit={submit} className="space-y-4">
          <SectionCard title="2. Customer and Car">
            <BookingCard b={b} />
            {b.balance > 0 && (
              <p className="mt-3 text-sm flex items-center gap-2 text-orange-600">
                <TriangleAlert size={16} />
                This booking still has {formatPKR(b.balance)} to be received.
              </p>
            )}
          </SectionCard>

          <SectionCard title="3. Car Condition Now">
            <div className="grid sm:grid-cols-3 gap-3">
              <FormInput name="meter" type="number" min={0} label="Current Meter Reading (km)" required />
              <FormSelect name="fuel" label="Fuel Level" required options={FUEL} placeholder={null} />
              <FormSelect
                name="staffId"
                label="Employee Handing Over"
                required
                options={(staff?.items || []).map((employee) => ({
                  value: employee.id,
                  label: employee.name,
                }))}
                placeholder={
                  staffLoading
                    ? 'Loading employees...'
                    : staffError
                      ? 'Unable to load employees'
                      : 'Select employee'
                }
                disabled={staffLoading || staffError}
              />
            </div>
            <FormInput
              name="damage"
              as="textarea"
              label="Damage Already On The Car (if any)"
              className="mt-3"
              placeholder="e.g. Small scratch on front bumper"
            />
            <FormPhotoUpload name="photos" label="Car Condition Photos" className="mt-3" />
          </SectionCard>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-neutral" onClick={() => setBookingId('')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success btn-lg" disabled={isLoading}>
              <KeyRound size={18} />
              {isLoading ? 'Saving…' : 'Issue Car'}
            </button>
          </div>
        </Form>
      )}

      {!bookingId && (
        <SectionCard>
          <EmptyState
            icon={KeyRound}
            title="Choose a booking"
            message="Select a reserved booking above to hand the car to the customer."
          />
        </SectionCard>
      )}
    </>
  );
}

function ReturnPanel({ bookingId, setBookingId }) {
  const { user } = useAuth();
  const { data: b } = useGetBookingQuery(bookingId, { skip: !bookingId });

  const {
    data: staff,
    isLoading: staffLoading,
    isError: staffError,
  } = useGetStaffQuery({
    status: 'active',
    pageSize: 100,
  });

  // No useGetSettingsQuery – it does not exist in systemApi.
  // Use defaults so the return form still calculates correctly.
  const settings = DEFAULT_SETTINGS;

  const [ret, { isLoading }] = useReturnCarMutation();
  const [done, setDone] = useState(null);

  const now = new Date();
  const form = useForm({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      bookingId,
      returnedDate: toDay(now),
      returnedTime: '10:00',
      meter: '',
      fuel: 'Full',
      damage: '',
      damageCharge: '',
      otherCharge: '',
      payNow: '',
      method: 'Cash',
      photos: [],
      staffId: user?.id || '',
    },
  });

  useEffect(() => {
    form.setValue('bookingId', bookingId);
    form.setValue(
      'returnedTime',
      format(now, 'HH:mm').slice(0, 3) + (now.getMinutes() < 30 ? '00' : '30')
    );
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const w = form.watch();
  const calc = useMemo(
    () =>
      b && b.issue
        ? calcReturn({
            booking: b,
            settings,
            returnedAt: joinDT(w.returnedDate, w.returnedTime),
            meterOut: b.issue.meter,
            meterIn: Number(w.meter) || b.issue.meter,
            damageCharge: w.damageCharge,
            otherCharge: w.otherCharge,
          })
        : null,
    [b, settings, w.returnedDate, w.returnedTime, w.meter, w.damageCharge, w.otherCharge]
  );

  if (done) {
    return (
      <Done
        b={done}
        kind="return"
        onAgain={() => {
          setDone(null);
          setBookingId('');
          form.reset();
        }}
      />
    );
  }

  const submit = async (v) => {
    if (Number(v.payNow) > calc.customerPays) {
      form.setError('payNow', {
        message: `Cannot be more than ${formatPKR(calc.customerPays)}`,
      });
      return;
    }
    try {
      const other = Number(v.otherCharge) || 0;
      const r = await ret({
        bookingId,
        meter: v.meter,
        fuel: v.fuel,
        damage: v.damage,
        condition: v.damage?.trim() ? 'damaged' : 'good',
        photos: v.photos,
        damageCharges: (Number(v.damageCharge) || 0) + other,
        lateCharges: calc.lateCharge,
        extraKmCharges: 0,
        notes: other > 0 ? `Other charges included in damage charges: Rs. ${other}` : '',
      }).unwrap();
      toast.success('Car returned successfully');
      setDone(finish(b, r, 'returnInfo', 'Completed'));
      if (Number(v.payNow) > 0) {
        toast.warning(
          `Payment of ${formatPKR(Number(v.payNow))} was not recorded. Use Receive Payment on the booking.`
        );
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const R = ({ k, v, bold, tone }) => (
    <div className={`flex justify-between py-1 text-sm ${bold ? 'font-extrabold border-t border-line mt-1 pt-2' : ''}`}>
      <span className={bold ? '' : 'text-muted'}>{k}</span>
      <span className={tone}>{v}</span>
    </div>
  );

  return (
    <>
      <SectionCard title="1. Select Active Rental">
        <BookingPick mode="return" value={bookingId} onChange={setBookingId} />
      </SectionCard>

      {b && calc && (
        <Form form={form} onSubmit={submit} className="space-y-4">
          <SectionCard title="2. Customer and Car">
            <BookingCard b={b} />
            <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
              <div className="rounded-xl border border-line p-3">
                <p className="font-semibold text-primary mb-1">Before - when issued</p>
                <p>{fmtDateTime(b.issue.at)}</p>
                <p>
                  Meter <b>{formatNum(b.issue.meter)} km</b> · Fuel <b>{b.issue.fuel}</b>
                </p>
                <p className="text-muted">Damage: {b.issue.damage || 'None'}</p>
                <div className="flex gap-1 mt-2">
                  {b.issue.photos?.map((u, i) => (
                    <SmartImage key={i} src={u} alt="Before" width={56} height={38} className="rounded border border-line" />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
                <p className="font-semibold text-primary mb-1">After - fill in below</p>
                <p>
                  Meter <b>{w.meter ? `${formatNum(w.meter)} km` : '-'}</b> · Fuel <b>{w.fuel}</b>
                </p>
                <p className="text-muted">New damage: {w.damage || 'None'}</p>
                <p className="text-xs text-muted mt-1">Photos added: {w.photos?.length || 0}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="3. Car Condition On Return">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FormDatePicker name="returnedDate" label="Return Date" required />
              <FormTimePicker name="returnedTime" label="Return Time" />
              <FormInput name="meter" type="number" min={b.issue.meter} label="Final Meter Reading (km)" required />
              <FormSelect name="fuel" label="Fuel Level" required options={FUEL} placeholder={null} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <FormInput name="damage" as="textarea" label="New Damage (if any)" placeholder="e.g. Dent on left door" />
              <FormSelect
                name="staffId"
                label="Employee Receiving The Car"
                required
                options={(staff?.items || []).map((employee) => ({
                  value: employee.id,
                  label: employee.name,
                }))}
                placeholder={
                  staffLoading
                    ? 'Loading employees...'
                    : staffError
                      ? 'Unable to load employees'
                      : 'Select employee'
                }
                disabled={staffLoading || staffError}
              />
            </div>
            <FormPhotoUpload name="photos" label="Return Condition Photos" className="mt-3" />
          </SectionCard>

          <SectionCard title="4. Final Charges">
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <MoneyInput name="damageCharge" label="Damage Charge" />
                  <MoneyInput name="otherCharge" label="Other Charge" />
                </div>
                <p className="text-xs text-muted">
                  Late charge, extra days and extra kilometres are worked out automatically (grace{' '}
                  {settings.graceHours} hour, {settings.kmLimitPerDay} km per day free, Rs.{' '}
                  {settings.extraKmRate} per extra km).
                </p>
                <MoneyInput
                  name="payNow"
                  label="Receive Payment Now"
                  hint={`Amount due from customer: ${formatPKR(calc.customerPays)}`}
                />
                {calc.customerPays > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => form.setValue('payNow', calc.customerPays)}
                  >
                    Receive full {formatPKR(calc.customerPays)}
                  </button>
                )}
                {Number(w.payNow) > 0 && <PaymentMethodPicker name="method" />}
              </div>

              <div className="rounded-2xl bg-soft border border-line p-4">
                <R k={`Rent (${b.days} ${b.rateType === 'hourly' ? 'hours' : 'days'})`} v={formatPKR(b.rentAmount)} />
                {b.additionalTotal > 0 && <R k="Charges already added" v={formatPKR(b.additionalTotal)} />}
                <R
                  k={`Late return (${calc.extraDays} extra day${calc.extraDays === 1 ? '' : 's'})`}
                  v={formatPKR(calc.lateCharge)}
                  tone={calc.lateCharge ? 'text-danger' : ''}
                />
                <R
                  k="Damage and other charges"
                  v={formatPKR((Number(w.damageCharge) || 0) + (Number(w.otherCharge) || 0))}
                />
                <R k="Final Total Bill" v={formatPKR(calc.total)} bold />
                <R k="Amount Already Received" v={formatPKR(b.paid)} />
                <R
                  k="Balance"
                  v={formatPKR(calc.balance)}
                  bold
                  tone={calc.balance > 0 ? 'text-danger' : 'text-success'}
                />
                <div className="mt-3 rounded-xl bg-warning/10 border border-warning/30 p-2.5 text-sm">
                  <b>Security deposit held: {formatPKR(calc.deposit)}</b>
                  <br />
                  Used for the bill: {formatPKR(calc.depositAdjusted)} ·{' '}
                  <b>Refund to customer: {formatPKR(calc.depositRefund)}</b>
                </div>
                <div className="mt-3 flex justify-between items-center rounded-xl bg-primary text-white px-3 py-2.5">
                  <span className="font-semibold">Customer pays now</span>
                  <b className="text-xl">{formatPKR(calc.customerPays)}</b>
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-neutral" onClick={() => setBookingId('')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success btn-lg" disabled={isLoading}>
              <Undo2 size={18} />
              {isLoading ? 'Saving…' : 'Return Car'}
            </button>
          </div>
        </Form>
      )}

      {!bookingId && (
        <SectionCard>
          <EmptyState
            icon={Undo2}
            title="Choose an active rental"
            message="Select the booking of the car that is coming back."
          />
        </SectionCard>
      )}
    </>
  );
}

export default function IssueReturnPage() {
  const { params, setParams } = useListParams({ mode: 'issue' });
  const { can } = useAuth();
  const mode = params.mode === 'return' ? 'return' : 'issue';
  const bookingId = params.bookingId || '';
  const setBooking = (id) => setParams({ bookingId: id }, { keepPage: true });

  return (
    <PermissionGuard perm="issue.view" page>
      <PageHeader
        title="Car Issue / Return"
        subtitle="Hand over a car to the customer, or take it back, in a few simple steps."
      />
      <PageContainer>
        <div className="card px-3 pt-2">
          <Tabs
            value={mode}
            onChange={(m) => setParams({ mode: m, bookingId: '' }, { keepPage: true })}
            tabs={[
              { value: 'issue', label: 'Issue Car' },
              { value: 'return', label: 'Return Car' },
            ]}
          />
        </div>

        {can('issue:create') ? (
          mode === 'issue' ? (
            <IssuePanel key="i" bookingId={bookingId} setBookingId={setBooking} />
          ) : (
            <ReturnPanel key="r" bookingId={bookingId} setBookingId={setBooking} />
          )
        ) : (
          <SectionCard>
            <EmptyState
              title="View only"
              message="You can see handover records but cannot issue or return cars."
            />
          </SectionCard>
        )}
      </PageContainer>
    </PermissionGuard>
  );
}