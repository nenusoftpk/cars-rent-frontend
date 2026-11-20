'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Plus,
  TriangleAlert,
  CircleCheck,
  Search,
  Check,
  Phone,
  Mail,
  MapPin,
  Fuel,
  Settings2,
  Users,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage, { Avatar } from '@/components/common/SmartImage';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormImageUpload from '@/components/forms/FormImageUpload';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import FormTimePicker from '@/components/forms/FormTimePicker';
import FormCheckbox from '@/components/forms/FormCheckbox';
import FormRadioGroup from '@/components/forms/FormRadioGroup';
import MoneyInput from '@/components/forms/MoneyInput';
import CustomerSelector from '@/components/forms/CustomerSelector';
import CustomerFormModal from '@/features/customers/CustomerFormModal';
import PaymentMethodPicker from '@/features/bookings/PaymentMethodPicker';
import { bookingSchema } from '@/validations';
import { useGetCustomerQuery } from '@/redux/api/customerApi';
import {
  useGetCarsQuery,
  useGetCarQuery,
  useGetCarStatsQuery,
} from '@/redux/api/carApi';
import { useGetDriversQuery } from '@/redux/api/driverApi';
import { useGetStaffQuery } from '@/redux/api/staffApi';
import {
  useCheckAvailabilityQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
  useGetBookingQuery,
  payMethod,
} from '@/redux/api/bookingApi';
import { useAddPaymentMutation } from '@/redux/api/paymentApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useAuth } from '@/hooks/useAuth';
import { calcRental } from '@/lib/pricing';
import { formatPKR } from '@/lib/money';
import { toDay, joinDT, splitDT, fmtDateTime } from '@/lib/dates';
import { uid, cn } from '@/lib/utils';
import { LOCATIONS } from '@/constants';

// useGetStaffOptionsQuery may return an array OR { items } / { data } – always get a list
const asList = (v) =>
  Array.isArray(v)
    ? v
    : Array.isArray(v?.items)
      ? v.items
      : Array.isArray(v?.data)
        ? v.data
        : Array.isArray(v?.data?.items)
          ? v.data.items
          : [];
const staffOptions = (v) =>
  asList(v).map((s) => ({
    value: s.id || s._id,
    label: s.name || s.fullName || s.email || '',
  }));

// the screenshot may be a File, a Blob, a { file } wrapper or a data:/blob: preview string
const toBlob = async (v) => {
  if (v instanceof Blob) return v;
  if (v?.file instanceof Blob) return v.file;
  const src = typeof v === 'string' ? v : v?.preview || v?.url || '';
  if (/^(data|blob):/i.test(src)) {
    try {
      return await (await fetch(src)).blob();
    } catch {
      return null;
    }
  }
  return null;
};
const PROOF_REQUIRED = ['bank', 'jazzcash', 'easypaisa'];

const CHARGES = [
  ['ExtraKm', 'Extra Kilometre Charge'],
  ['Late', 'Late Return Charge'],
  ['Damage', 'Damage Charge'],
  ['Other', 'Other Charges (cleaning etc.)'],
];
const chargeKey = {
  'Extra Kilometre Charge': 'ExtraKm',
  'Extra Kilometer Charge': 'ExtraKm',
  'Late Return Charge': 'Late',
  'Damage Charge': 'Damage',
  'Other Charges (cleaning etc.)': 'Other',
};

export default function NewBookingPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();
  const editId = sp.get('edit');
  const [addCust, setAddCust] = useState(false);
  const [review, setReview] = useState(false);
  const [carStatus, setCarStatus] = useState('');
  const [carSearch, setCarSearch] = useState('');
  const reqId = useRef(uid('bk'));
  const [pay] = useAddPaymentMutation();
  const [create, { isLoading: creating }] = useCreateBookingMutation();
  const [update, { isLoading: updating }] = useUpdateBookingMutation();
  const { data: editing } = useGetBookingQuery(editId, { skip: !editId });
  const {
    data: staff,
    isLoading: staffLoading,
    isError: staffError,
  } = useGetStaffQuery({
    status: 'active',
    pageSize: 100,
  });
  const { data: drivers } = useGetDriversQuery({ status: 'Active', pageSize: 50 });

  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerId: sp.get('customerId') || '',
      carId: sp.get('carId') || '',
      pickupDate: toDay(),
      pickupTime: '10:00',
      returnDate: toDay(addDays(new Date(), 3)),
      returnTime: '10:00',
      rateType: 'daily',
      driverId: '',
      // Customer-facing driver charges (income)
      addDriverCharges: false,
      driverChargeRate: '',
      staffId: user?.role === 'employee' ? user.id : '',
      pickupLocation: 'Office Branch',
      returnLocation: 'Same as Pickup',
      instructions: '',
      chargeExtraKm: false,
      amountExtraKm: '',
      chargeLate: false,
      amountLate: '',
      chargeDamage: false,
      amountDamage: '',
      chargeOther: false,
      amountOther: '',
      advance: '',
      deposit: '',
      method: '',
      paymentProof: null,
    },
  });

  useEffect(() => {
    if (!editing) return;
    const p = splitDT(editing.pickupAt);
    const r = splitDT(editing.returnAt);
    const c = {};
    (editing.charges || []).forEach((x) => {
      const k = chargeKey[x.label];
      if (k) {
        c[`charge${k}`] = true;
        c[`amount${k}`] = x.amount;
      }
    });

    // Restore driver charges if present on the booking
    const hasDriverCharges =
      Number(editing.driverCharges) > 0 ||
      Number(editing.driverChargeRate) > 0;

    form.reset({
      ...form.getValues(),
      customerId: editing.customerId,
      carId: editing.carId,
      pickupDate: p.date,
      pickupTime: p.time,
      returnDate: r.date,
      returnTime: r.time,
      rateType: editing.rateType,
      driverId: editing.driverId || '',
      addDriverCharges: hasDriverCharges,
      driverChargeRate:
        editing.driverChargeRate != null
          ? editing.driverChargeRate
          : editing.driverCharges && editing.days
            ? Number(editing.driverCharges) / Number(editing.days)
            : '',
      staffId: editing.staffId,
      pickupLocation: editing.pickupLocation,
      returnLocation: editing.returnLocation,
      instructions: editing.instructions,
      ...c,
    });
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const w = form.watch();
  const pickupAt = joinDT(w.pickupDate, w.pickupTime);
  const returnAt = joinDT(w.returnDate, w.returnTime);

  const { data: car } = useGetCarQuery(w.carId, { skip: !w.carId });
  const { data: cust } = useGetCustomerQuery(w.customerId, {
    skip: !w.customerId,
  });

  const rt = useMemo(
    () =>
      calcRental({
        pickupAt,
        returnAt,
        dailyRate: car?.dailyRate,
        hourlyRate: car?.hourlyRate,
        rateType: w.rateType,
      }),
    [pickupAt, returnAt, car, w.rateType]
  );

  // Extra charges (damage, late, etc.)
  const charges = CHARGES.filter(
    ([k]) => w[`charge${k}`] && Number(w[`amount${k}`]) > 0
  ).map(([k, label]) => ({
    label,
    amount: Number(w[`amount${k}`]),
  }));
  const extra = charges.reduce((s, c) => s + c.amount, 0);

  // Customer-facing driver charges (income) – only when a driver is selected
  // and the checkbox is on. Rate is per day or per hour matching the booking.
  const units = rt.valid ? rt.units || rt.days || 0 : 0;
  const driverChargeRate = Number(w.driverChargeRate) || 0;
  const driverCharges =
    w.driverId && w.addDriverCharges && driverChargeRate > 0 && units > 0
      ? Math.round(driverChargeRate * units * 100) / 100
      : 0;

  const total = rt.amount + extra + driverCharges;
  const advance = Number(w.advance) || 0;
  const deposit = Number(w.deposit) || 0;
  const remaining = total - advance;

  const { data: avail, isFetching: checking } = useCheckAvailabilityQuery(
    {
      carId: w.carId,
      from: pickupAt,
      to: returnAt,
      excludeId: editId,
    },
    { skip: !w.carId || !rt.valid }
  );
  const unavailable = avail && !avail.available;

  const { data: cars, isLoading: carsLoading } = useGetCarsQuery({
    pageSize: 50,
    sort: 'name:asc',
    search: carSearch,
    status: carStatus,
  });
  const { data: counts } = useGetCarStatsQuery();
  const hourlyOk = car ? car.hourlyRate > 0 : true;

  // Clear driver-charge fields when driver is removed
  useEffect(() => {
    if (!w.driverId) {
      form.setValue('addDriverCharges', false);
      form.setValue('driverChargeRate', '');
    }
  }, [w.driverId]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = [
    ['Customer', !!w.customerId],
    ['Car', !!w.carId && !unavailable],
    ['Dates', rt.valid],
    ['Details', !!w.staffId],
    ['Payment', advance + deposit === 0 || !!w.method],
    ['Review', false],
  ];

  // bookingApi maps these to backend names.
  // driverChargeRate + driverCharges are the NEW customer-bill fields.
  // The existing driverPayment* fields (expense side) stay managed by the backend.
  const payload = () => ({
    customerId: w.customerId,
    carId: w.carId,
    pickupAt,
    returnAt,
    rateType: w.rateType,
    driverId: w.driverId || null,
    staffId: w.staffId,
    pickupLocation: w.pickupLocation,
    returnLocation: w.returnLocation,
    instructions: w.instructions,
    // Customer-facing driver charges (income)
    driverChargeRate: w.driverId && w.addDriverCharges ? driverChargeRate : 0,
    driverCharges: w.driverId && w.addDriverCharges ? driverCharges : 0,
    ...(editId
      ? {}
      : {
          deposit,
          method: w.method,
        }),
  });

  const confirm = async () => {
    try {
      const b = editId
        ? await update({ id: editId, ...payload() }).unwrap()
        : await create(payload()).unwrap();

      // Advance and security deposit are receipts: separate calls after the booking exists.
      let payError = null;
      if (!editId && (advance > 0 || deposit > 0)) {
        const proof = await toBlob(form.getValues().paymentProof);
        const base = {
          bookingId: b.id,
          method: w.method,
          paymentDate: toDay(),
          paymentProof: proof,
        };
        try {
          if (advance > 0)
            await pay({
              ...base,
              type: 'Advance',
              amount: advance,
              requestId: `${reqId.current}-advance`,
            }).unwrap();
          if (deposit > 0)
            await pay({
              ...base,
              type: 'Security Deposit',
              amount: deposit,
              requestId: `${reqId.current}-deposit`,
            }).unwrap();
        } catch (e) {
          payError = e;
        }
      }

      toast.success(
        editId
          ? 'Booking changes saved successfully'
          : 'Booking created successfully'
      );
      if (payError)
        toast.error(
          `Booking saved, but a payment was not recorded: ${errorMessage(
            payError
          )}. Record it with Receive Payment.`
        );
      if (charges.length)
        toast.warning(
          'Additional charges were not saved with the booking. Add them when the car is returned.'
        );
      router.push(`/bookings/${b.id}`);
    } catch (e) {
      setReview(false);
      toast.error(errorMessage(e));
      if (e?.status === 409 && !editId) reqId.current = uid('bk');
    }
  };

  const method = payMethod(w.method);
  const needsProof =
    !editId && advance + deposit > 0 && !!method && method !== 'cash';

  const submit = async () => {
    if (unavailable) {
      toast.error(avail.message);
      return;
    }
    if (!editId && advance + deposit > 0) {
      if (!method) {
        toast.error('Please choose how the advance / deposit was paid.');
        return;
      }
      if (
        PROOF_REQUIRED.includes(method) &&
        !(await toBlob(form.getValues().paymentProof))
      ) {
        toast.error(
          'Please upload the payment screenshot for this payment method.'
        );
        return;
      }
    }
    setReview(true);
  };

  const rateLabel =
    w.rateType === 'hourly' ? 'per hour' : 'per day';
  const unitLabel =
    w.rateType === 'hourly'
      ? units === 1
        ? '1 hour'
        : `${units} hours`
      : units === 1
        ? '1 day'
        : `${units} days`;

  return (
    <PermissionGuard perm="bookings.create" page>
      <PageHeader
        title={editId ? 'Edit Booking' : 'New Booking'}
        subtitle="Select customer, choose a car and create a new booking."
        breadcrumb={[
          { label: 'Bookings', href: '/bookings' },
          { label: editId ? 'Edit Booking' : 'New Booking' },
        ]}
      />
      <PageContainer>
        <ol
          className="card flex items-center gap-1 overflow-x-auto px-4 py-3 text-xs sm:text-sm"
          aria-label="Booking steps"
        >
          {steps.map(([l, ok], i) => (
            <li key={l} className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  'grid place-items-center size-6 rounded-full text-xs font-bold',
                  ok ? 'bg-success text-white' : 'bg-primary/10 text-primary'
                )}
              >
                {ok ? <Check size={13} /> : i + 1}
              </span>
              <span className={ok ? 'font-semibold' : 'text-muted'}>{l}</span>
              {i < steps.length - 1 && (
                <span className="w-6 h-px bg-line mx-1" />
              )}
            </li>
          ))}
        </ol>

        <Form
          form={form}
          onSubmit={submit}
          className="grid gap-4 xl:grid-cols-[1fr_380px] items-start"
        >
          <div className="space-y-4 min-w-0">
            {/* 1. Customer */}
            <SectionCard
              number={1}
              title="Select Customer"
              actions={
                <PermissionGuard perm="customers.create">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setAddCust(true)}
                  >
                    <Plus size={15} />
                    Add New Customer
                  </button>
                </PermissionGuard>
              }
            >
              <CustomerSelector
                name="customerId"
                required={false}
                label=""
                disabled={!!editId}
              />
              {cust && (
                <div className="mt-3 rounded-xl border border-line bg-soft p-3 flex flex-wrap gap-4 items-center">
                  <Avatar src={cust.photo} name={cust.name} size={64} />
                  <div className="min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <b className="text-base">{cust.name}</b>
                      {cust.type && <StatusBadge status={cust.type} />}
                    </div>
                    <p className="text-sm text-muted flex items-center gap-1.5">
                      <Phone size={13} />
                      {cust.mobile}
                    </p>
                    {cust.email && (
                      <p className="text-sm text-muted flex items-center gap-1.5">
                        <Mail size={13} />
                        {cust.email}
                      </p>
                    )}
                    <p className="text-sm text-muted flex items-center gap-1.5">
                      <MapPin size={13} />
                      {cust.city}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {[
                      ['CNIC Front', cust.cnicFront],
                      ['CNIC Back', cust.cnicBack],
                      ['Licence', cust.licenseImage],
                    ].map(([l, u]) => (
                      <div key={l} className="text-center">
                        <div className="w-16 h-11 rounded-md bg-white border border-line overflow-hidden grid place-items-center">
                          {u ? (
                            <SmartImage
                              src={u}
                              alt={l}
                              width={64}
                              height={44}
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-muted">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted mt-0.5">{l}</p>
                      </div>
                    ))}
                  </div>
                  <dl className="ml-auto text-sm grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
                    <dt className="text-muted">Total Bookings</dt>
                    <dd className="font-bold">{cust.totalBookings}</dd>
                    <dt className="text-muted">Total Spent</dt>
                    <dd className="font-bold">{formatPKR(cust.totalSpent)}</dd>
                    <dt className="text-muted">Pending Balance</dt>
                    <dd
                      className={cn(
                        'font-bold',
                        cust.pending > 0 && 'text-danger'
                      )}
                    >
                      {formatPKR(cust.pending)}
                    </dd>
                  </dl>
                </div>
              )}
            </SectionCard>

            {/* 2. Car */}
            <SectionCard
              number={2}
              title="Select Car"
              actions={
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    className="input !h-9 pl-8 !w-56"
                    placeholder="Search car or number plate…"
                    value={carSearch}
                    onChange={(e) => setCarSearch(e.target.value)}
                    aria-label="Search cars"
                  />
                </div>
              }
            >
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  ['', 'All Cars', counts?.total],
                  ['Available', 'Available', counts?.available],
                  ['On Rent', 'On Rent', counts?.onRent],
                  ['Under Repair', 'Under Repair', counts?.repair],
                ].map(([v, l, n]) => (
                  <button
                    type="button"
                    key={l}
                    className={cn('chip', carStatus === v && 'chip-active')}
                    onClick={() => setCarStatus(v)}
                  >
                    {l}
                    {n != null && <span className="font-bold">{n}</span>}
                  </button>
                ))}
              </div>
              {carsLoading ? (
                <div className="skeleton h-40" />
              ) : !cars?.items.length ? (
                <p className="text-sm text-muted text-center py-6">
                  No cars found.
                </p>
              ) : (
                <div
                  className="grid gap-3 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 max-h-[420px] overflow-y-auto p-1"
                  role="radiogroup"
                  aria-label="Cars"
                >
                  {cars.items.map((c) => {
                    const sel = w.carId === c.id;
                    const blocked =
                      c.freeForDates === false ||
                      ['Under Repair', 'Out of Service'].includes(c.status);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        role="radio"
                        aria-checked={sel}
                        disabled={blocked}
                        onClick={() =>
                          form.setValue('carId', c.id, {
                            shouldValidate: true,
                          })
                        }
                        className={cn(
                          'relative text-left rounded-xl border p-2.5 transition',
                          sel
                            ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                            : 'border-line bg-white hover:border-primary/40',
                          blocked && 'opacity-55 cursor-not-allowed'
                        )}
                      >
                        {sel && (
                          <span className="absolute right-2 top-2 grid place-items-center size-5 rounded-full bg-primary text-white">
                            <Check size={12} />
                          </span>
                        )}
                        <SmartImage
                          src={c.image}
                          alt={c.name}
                          width={200}
                          height={100}
                          className="w-full h-20 object-contain"
                        />
                        <div className="flex items-center justify-between gap-1 mt-1">
                          <b className="text-sm truncate">{c.name}</b>
                        </div>
                        <p className="text-xs text-muted">
                          {c.year} · {c.plate}
                        </p>
                        <div className="flex gap-2 text-[10px] text-muted my-1">
                          <span className="flex items-center gap-0.5">
                            <Settings2 size={10} />
                            {c.transmission}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Fuel size={10} />
                            {c.fuel}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Users size={10} />
                            {c.seats}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <b className="text-primary text-sm">
                            {formatPKR(c.dailyRate)}
                            <span className="text-[10px] text-muted font-medium">
                              {' '}
                              /day
                            </span>
                          </b>
                          {blocked ? (
                            <span className="badge badge-danger">
                              {['Under Repair', 'Out of Service'].includes(
                                c.status
                              )
                                ? c.status
                                : 'Booked'}
                            </span>
                          ) : (
                            <span className="badge badge-success">
                              {rt.valid ? 'Free' : c.status}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {form.formState.errors.carId && (
                <p className="field-error">
                  {form.formState.errors.carId.message}
                </p>
              )}
              {unavailable && (
                <div
                  className="mt-3 flex gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
                  role="alert"
                >
                  <TriangleAlert size={18} className="shrink-0" />
                  <span>
                    {avail.message} Please choose different dates or another
                    car.
                  </span>
                </div>
              )}
              {avail?.available && w.carId && rt.valid && (
                <div className="mt-3 flex gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success">
                  <CircleCheck size={18} className="shrink-0" />
                  This car is free for the selected dates.
                </div>
              )}
            </SectionCard>

            {/* 3. Dates */}
            <SectionCard number={3} title="Pick Up & Return">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="grid grid-cols-[1fr_130px] gap-2">
                  <FormDatePicker
                    name="pickupDate"
                    label="Pick Up Date"
                    required
                  />
                  <FormTimePicker name="pickupTime" label="Time" />
                </div>
                <div className="grid grid-cols-[1fr_130px] gap-2">
                  <FormDatePicker
                    name="returnDate"
                    label="Return Date"
                    required
                  />
                  <FormTimePicker name="returnTime" label="Time" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <FormRadioGroup
                  name="rateType"
                  label="Charge By"
                  options={[
                    { value: 'daily', label: 'Per Day' },
                    ...(hourlyOk
                      ? [{ value: 'hourly', label: 'Per Hour' }]
                      : []),
                  ]}
                />
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-2 text-sm">
                  <span className="text-muted">Rental Period: </span>
                  <b className="text-primary">
                    {rt.valid ? rt.label : 'Choose valid dates'}
                  </b>
                </div>
              </div>
            </SectionCard>

            {/* 4. Booking Details + Driver Charges */}
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard number={4} title="Booking Details">
                <div className="grid sm:grid-cols-2 gap-3">
                  <FormSelect
                    name="driverId"
                    label="Driver (Optional)"
                    options={(drivers?.items || []).map((d) => ({
                      value: d.id,
                      label: d.name,
                    }))}
                    placeholder="No driver"
                  />
                  <FormSelect
                    name="staffId"
                    label="Responsible Employee"
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
                  <FormSelect
                    name="pickupLocation"
                    label="Pick Up Location"
                    options={LOCATIONS}
                    placeholder={null}
                  />
                  <FormSelect
                    name="returnLocation"
                    label="Return Location"
                    options={['Same as Pickup', ...LOCATIONS]}
                    placeholder={null}
                  />
                  <FormInput
                    name="instructions"
                    as="textarea"
                    label="Special Instructions (Optional)"
                    className="sm:col-span-2"
                    placeholder="Any special instruction…"
                  />
                </div>

                {/* Driver Charges (customer bill / income) – only when a driver is selected */}
                {w.driverId && (
                  <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">
                          Driver Charges (Customer Bill)
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          Amount charged to the customer for the driver. This is
                          your income. The amount you later pay the driver is
                          set separately in Driver settings / Expenses.
                        </p>
                      </div>
                      <FormCheckbox
                        name="addDriverCharges"
                        label="Add to bill"
                      />
                    </div>

                    {w.addDriverCharges && (
                      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                        <MoneyInput
                          name="driverChargeRate"
                          label={`Driver rate (${rateLabel})`}
                          placeholder="0"
                          hint={`Charged ${rateLabel}. Multiplied by rental period.`}
                        />
                        <div className="rounded-xl bg-white border border-line px-3 py-2 text-sm min-w-[140px]">
                          <p className="text-xs text-muted">Total driver charges</p>
                          <p className="font-extrabold text-primary">
                            {formatPKR(driverCharges)}
                          </p>
                          <p className="text-[11px] text-muted">
                            {driverChargeRate > 0 && units > 0
                              ? `${formatPKR(driverChargeRate)} × ${unitLabel}`
                              : 'Enter rate above'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Additional Charges (If Any)"
                subtitle="Tick only if you want to add them now."
              >
                <div className="space-y-2.5">
                  {CHARGES.map(([k, label]) => (
                    <div
                      key={k}
                      className="grid grid-cols-[1fr_130px] gap-2 items-center"
                    >
                      <FormCheckbox name={`charge${k}`} label={label} />
                      <MoneyInput
                        name={`amount${k}`}
                        compact
                        disabled={!w[`charge${k}`]}
                        placeholder="0"
                        label=""
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>

          {/* Summary sidebar */}
          <aside className="space-y-4 xl:sticky xl:top-20">
            <SectionCard title="Booking Summary">
              {car ? (
                <div className="flex gap-3 items-center rounded-xl bg-soft border border-line p-2.5">
                  <SmartImage
                    src={car.image}
                    alt={car.name}
                    width={110}
                    height={66}
                    className="w-24 h-auto"
                  />
                  <div>
                    <b>{car.name}</b>
                    <p className="text-xs text-muted">
                      {car.year} · {car.plate}
                    </p>
                    <StatusBadge status={car.status} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted rounded-xl bg-soft p-3 text-center">
                  Select a car to see the price.
                </p>
              )}

              <dl className="mt-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-muted">Pick Up</dt>
                  <dd className="font-semibold">
                    {rt.valid ? fmtDateTime(pickupAt) : '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Return</dt>
                  <dd className="font-semibold">
                    {rt.valid ? fmtDateTime(returnAt) : '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Rental Period</dt>
                  <dd className="font-bold text-primary">
                    {rt.valid ? rt.label : '-'}
                  </dd>
                </div>
                <hr className="border-line my-2" />
                <div className="flex justify-between">
                  <dt className="text-muted">
                    {w.rateType === 'hourly' ? 'Hourly Rent' : 'Daily Rent'}
                  </dt>
                  <dd className="font-semibold">{formatPKR(rt.rate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">
                    Total Rent ({rt.valid ? rt.label : '-'})
                  </dt>
                  <dd className="font-semibold">{formatPKR(rt.amount)}</dd>
                </div>

                {/* Driver charges line on the customer bill */}
                {driverCharges > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      Driver Charges ({unitLabel})
                    </dt>
                    <dd className="font-semibold">
                      {formatPKR(driverCharges)}
                    </dd>
                  </div>
                )}

                {extra > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">Additional Charges</dt>
                    <dd className="font-semibold">{formatPKR(extra)}</dd>
                  </div>
                )}

                <div className="flex justify-between border-t border-line pt-2">
                  <dt className="font-bold">Total Bill</dt>
                  <dd className="font-extrabold">{formatPKR(total)}</dd>
                </div>
              </dl>

              {!editId && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <MoneyInput name="advance" label="Advance Payment" />
                  <MoneyInput
                    name="deposit"
                    label="Security Deposit"
                    hint="Refundable. Kept separate."
                  />
                </div>
              )}

              <div className="flex justify-between items-center rounded-xl bg-success/10 px-3 py-2.5 mt-3">
                <span className="font-semibold">Remaining Amount</span>
                <b className="text-xl text-success">
                  {formatPKR(remaining)}
                </b>
              </div>

              {!editId && (
                <div className="mt-3">
                  <PaymentMethodPicker name="method" />
                </div>
              )}
              {needsProof && (
                <div className="mt-3">
                  <FormImageUpload
                    name="paymentProof"
                    label={`Payment Screenshot (${
                      PROOF_REQUIRED.includes(method) ? 'required' : 'optional'
                    })`}
                    width="w-full"
                    height="h-28"
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn btn-success btn-lg w-full mt-4"
                disabled={creating || updating || checking || unavailable}
              >
                <CircleCheck size={20} />
                {editId ? 'Save Booking Changes' : 'Confirm Booking'}
              </button>
              <Link href="/bookings" className="btn btn-neutral w-full mt-2">
                Cancel
              </Link>
            </SectionCard>
          </aside>
        </Form>
      </PageContainer>

      <CustomerFormModal
        open={addCust}
        customer={null}
        onClose={() => setAddCust(false)}
        onSaved={(c) =>
          form.setValue('customerId', c.id, { shouldValidate: true })
        }
      />

      <AppModal
        open={review}
        onClose={() => setReview(false)}
        title="Review Booking"
        subtitle="Please check everything before confirming."
        size="sm"
        footer={
          <>
            <button
              className="btn btn-neutral"
              onClick={() => setReview(false)}
              disabled={creating || updating}
            >
              Go Back
            </button>
            <button
              className="btn btn-success"
              onClick={confirm}
              disabled={creating || updating}
            >
              <CircleCheck size={16} />
              {creating || updating ? 'Saving…' : 'Yes, Confirm Booking'}
            </button>
          </>
        }
      >
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-muted">Customer</dt>
            <dd className="font-semibold">{cust?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Car</dt>
            <dd className="font-semibold">
              {car?.name} ({car?.plate})
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Pick Up</dt>
            <dd className="font-semibold">{fmtDateTime(pickupAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Return</dt>
            <dd className="font-semibold">{fmtDateTime(returnAt)}</dd>
          </div>
          {w.driverId && (
            <div className="flex justify-between">
              <dt className="text-muted">Driver</dt>
              <dd className="font-semibold">
                {(drivers?.items || []).find((d) => d.id === w.driverId)
                  ?.name || 'Selected'}
              </dd>
            </div>
          )}
          {driverCharges > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Driver Charges</dt>
              <dd className="font-semibold">{formatPKR(driverCharges)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Total Bill</dt>
            <dd className="font-bold">{formatPKR(total)}</dd>
          </div>
          {!editId && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted">Advance Received</dt>
                <dd className="font-semibold">
                  {formatPKR(advance)}{' '}
                  {advance > 0 && `(${w.method})`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">
                  Security Deposit (held separately)
                </dt>
                <dd className="font-semibold">{formatPKR(deposit)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-line pt-2">
            <dt className="font-bold">Remaining Amount</dt>
            <dd className="font-extrabold text-success">
              {formatPKR(remaining)}
            </dd>
          </div>
        </dl>
      </AppModal>
    </PermissionGuard>
  );
}