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
  Pencil,
  Printer,
  Fingerprint,
  Wifi,
  WifiOff,
  RefreshCw,
  Upload,
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
import FormLocationCombobox from '@/components/forms/FormLocationCombobox';
import FormDatePicker from '@/components/forms/FormDatePicker';
import FormTimePicker from '@/components/forms/FormTimePicker';
import FormCheckbox from '@/components/forms/FormCheckbox';
import MoneyInput from '@/components/forms/MoneyInput';
import CustomerSelector from '@/components/forms/CustomerSelector';
import CustomerFormModal from '@/features/customers/CustomerFormModal';
import PaymentMethodPicker from '@/features/bookings/PaymentMethodPicker';
import { bookingSchema } from '@/validations';
import { useGetCustomerQuery, useUpdateCustomerMutation } from '@/redux/api/customerApi';
import {
  useGetCarsQuery,
  useGetCarQuery,
  useGetCarStatsQuery,
  useUpdateCarMutation,
} from '@/redux/api/carApi';
import { useGetDriversQuery } from '@/redux/api/driverApi';
import { useGetStaffQuery } from '@/redux/api/staffApi';
import {
  useCheckAvailabilityQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
  useGetBookingQuery,
  useGetBookingsQuery,
  payMethod,
} from '@/redux/api/bookingApi';
import { useAddPaymentMutation } from '@/redux/api/paymentApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useAuth } from '@/hooks/useAuth';
import { calcRental } from '@/lib/pricing';
import { formatPKR } from '@/lib/money';
import { toDay, joinDT, splitDT, fmtDateTime, fmtDate } from '@/lib/dates';
import { uid, cn } from '@/lib/utils';
import { LOCATIONS } from '@/constants';
import { printHtml, rentalAgreementDoc } from '@/lib/printTemplates';
import { captureSecuGenThumb, checkSecuGenAvailable } from '@/lib/secugenCapture';
import { isBrowserOnline } from '@/offline/offlineAdapter';

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
  const { user, can } = useAuth();
  const editId = sp.get('edit');
  const [addCust, setAddCust] = useState(false);
  const [review, setReview] = useState(false);
  const [successBooking, setSuccessBooking] = useState(null); // full mapped booking after create
  const [carStatus, setCarStatus] = useState('');
  const [carSearch, setCarSearch] = useState('');
  const [editRateOpen, setEditRateOpen] = useState(false);
  const [newDailyRate, setNewDailyRate] = useState('');
  const [bioModal, setBioModal] = useState(null); // { booking, customer, car } when print needs biometric choice
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [thumbConsent, setThumbConsent] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(null);
  const [inkOnly, setInkOnly] = useState(false);
  const reqId = useRef(uid('bk'));
  const [pay] = useAddPaymentMutation();
  const [create, { isLoading: creating }] = useCreateBookingMutation();
  const [update, { isLoading: updating }] = useUpdateBookingMutation();
  const [updateCar, { isLoading: savingRate }] = useUpdateCarMutation();
  const [updateCustomer] = useUpdateCustomerMutation();
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

  // Distinct pickup/return locations already saved on bookings (tenant DB)
  const { data: pastBookings } = useGetBookingsQuery({
    pageSize: 100,
    sort: 'createdAt:desc',
  });

  const locationSuggestions = useMemo(() => {
    const items = pastBookings?.items || [];
    const set = new Set();
    const out = [];
    for (const b of items) {
      for (const loc of [b.pickupLocation, b.returnLocation]) {
        const v = String(loc || '').trim();
        if (!v) continue;
        if (v.toLowerCase() === 'same as pickup') continue;
        const key = v.toLowerCase();
        if (set.has(key)) continue;
        set.add(key);
        out.push(v);
      }
    }
    return out;
  }, [pastBookings]);

  const form = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerId: sp.get('customerId') || '',
      carId: sp.get('carId') || '',
      pickupDate: toDay(),
      pickupTime: '10:00',
      returnDate: toDay(addDays(new Date(), 3)),
      returnTime: '10:00',
      rateType: 'daily', // daily-only frontend
      driverId: '',
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

    const hasDriverCharges =
      Number(editing.driverCharges) > 0 ||
      Number(editing.driverChargeRate) > 0;

    // Preserve historical hourly bookings when editing; new bookings are daily-only
    form.reset({
      ...form.getValues(),
      customerId: editing.customerId,
      carId: editing.carId,
      pickupDate: p.date,
      pickupTime: p.time,
      returnDate: r.date,
      returnTime: r.time,
      rateType: editing.rateType || 'daily',
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

  const { data: car, refetch: refetchCar } = useGetCarQuery(w.carId, {
    skip: !w.carId,
  });
  const { data: cust } = useGetCustomerQuery(w.customerId, {
    skip: !w.customerId,
  });

  // Always use daily for new bookings; when editing an old hourly booking keep its type
  const effectiveRateType = editId && editing?.rateType === 'hourly' ? 'hourly' : 'daily';

  const rt = useMemo(
    () =>
      calcRental({
        pickupAt,
        returnAt,
        dailyRate: car?.dailyRate,
        hourlyRate: car?.hourlyRate,
        rateType: effectiveRateType,
      }),
    [pickupAt, returnAt, car, effectiveRateType]
  );

  const charges = CHARGES.filter(
    ([k]) => w[`charge${k}`] && Number(w[`amount${k}`]) > 0
  ).map(([k, label]) => ({
    label,
    amount: Number(w[`amount${k}`]),
  }));
  const extra = charges.reduce((s, c) => s + c.amount, 0);

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

  useEffect(() => {
    if (!w.driverId) {
      form.setValue('addDriverCharges', false);
      form.setValue('driverChargeRate', '');
    }
  }, [w.driverId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep rateType locked to daily for new bookings
  useEffect(() => {
    if (!editId) form.setValue('rateType', 'daily');
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = [
    ['Customer', !!w.customerId],
    ['Car', !!w.carId && !unavailable],
    ['Dates', rt.valid],
    ['Details', !!w.staffId],
    ['Payment', advance + deposit === 0 || !!w.method],
    ['Review', false],
  ];

  const payload = () => ({
    customerId: w.customerId,
    carId: w.carId,
    pickupAt,
    returnAt,
    rateType: effectiveRateType,
    driverId: w.driverId || null,
    staffId: w.staffId,
    pickupLocation: w.pickupLocation,
    returnLocation: w.returnLocation,
    instructions: w.instructions,
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

      if (editId) {
        toast.success('Booking changes saved successfully');
        if (payError)
          toast.error(
            `Booking saved, but a payment was not recorded: ${errorMessage(payError)}. Record it with Receive Payment.`
          );
        if (charges.length)
          toast.warning(
            'Additional charges were not saved with the booking. Add them when the car is returned.'
          );
        router.push(`/bookings/${b.id}`);
        return;
      }

      // NEW BOOKING SUCCESS → modal (do not navigate yet)
      toast.success('Booking created successfully');
      if (payError)
        toast.error(
          `Booking saved, but a payment was not recorded: ${errorMessage(payError)}. Record it with Receive Payment.`
        );
      if (charges.length)
        toast.warning(
          'Additional charges were not saved with the booking. Add them when the car is returned.'
        );

      // Enrich with live form values for the success modal display
      setSuccessBooking({
        ...b,
        customerName: cust?.name || b.customerName,
        customerMobile: cust?.mobile || b.customerMobile,
        customerPhoto: cust?.photo || b.customerPhoto,
        carName: car?.name || b.carName,
        carPlate: car?.plate || b.carPlate,
        carImage: car?.image || b.carImage,
        staffName:
          (staff?.items || []).find((s) => s.id === w.staffId)?.name ||
          b.staffName,
        rate: rt.rate,
        days: rt.days || units,
        rentAmount: rt.amount,
        total,
        paid: advance,
        balance: remaining,
        depositPaid: deposit,
        method: w.method,
        pickupAt,
        returnAt,
        rateType: 'daily',
      });
      setReview(false);
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
    if (!rt.valid) {
      toast.error('Return must be after pick-up. Check dates and times.');
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

  const unitLabel =
    units === 1 ? '1 day' : `${units} days`;

  // ---------- Editable daily rent ----------
  const canEditRate = can('cars.update') || can('cars:edit');
  const openEditRate = () => {
    if (!car || !canEditRate) return;
    setNewDailyRate(String(car.dailyRate ?? ''));
    setEditRateOpen(true);
  };
  const saveDailyRate = async () => {
    const n = Number(newDailyRate);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Enter a valid non-negative amount.');
      return;
    }
    try {
      await updateCar({ id: car.id, dailyRate: n }).unwrap();
      toast.success('Car daily rent updated. This applies to future bookings.');
      setEditRateOpen(false);
      refetchCar();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // ---------- Success modal actions ----------
  const resetForNewBooking = () => {
    setSuccessBooking(null);
    reqId.current = uid('bk');
    form.reset({
      ...form.getValues(),
      customerId: '',
      carId: '',
      pickupDate: toDay(),
      pickupTime: '10:00',
      returnDate: toDay(addDays(new Date(), 3)),
      returnTime: '10:00',
      rateType: 'daily',
      driverId: '',
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
    });
  };

  const goToBooking = () => {
    const id = successBooking?.id;
    setSuccessBooking(null);
    if (id) router.push(`/bookings/${id}`);
    else router.push('/bookings');
  };

  // ---------- Print + biometric flow ----------
  const startPrintFlow = async (bookingOverride) => {
    const b = bookingOverride || successBooking;
    if (!b) return;
    const customerId = b.customerId || w.customerId;
    const carId = b.carId || w.carId;

    // Fetch full records when possible
    let fullCustomer = cust;
    let fullCar = car;
    try {
      // Re-use already loaded data when IDs match; otherwise the print helper
      // will still work with the booking snapshot.
      if (cust?.id !== customerId) fullCustomer = cust;
      if (car?.id !== carId) fullCar = car;
    } catch {
      /* keep snapshot */
    }

    const hasBio =
      Boolean(fullCustomer?.hasFingerprint || fullCustomer?.biometric?.available) &&
      Boolean(fullCustomer?.biometric?.thumbImage);

    if (hasBio) {
      printAgreement({
        booking: b,
        customer: fullCustomer,
        car: fullCar,
        thumbImageUrl: fullCustomer.biometric.thumbImage,
        inkThumbBox: false,
      });
      return;
    }

    // Need biometric choice
    setThumbFile(null);
    setThumbPreview(null);
    setThumbConsent(false);
    setInkOnly(false);
    setScannerReady(null);
    setBioModal({ booking: b, customer: fullCustomer, car: fullCar });
    // lightweight scanner check
    try {
      const ok = await checkSecuGenAvailable();
      setScannerReady(ok);
    } catch {
      setScannerReady(false);
    }
  };

  const printAgreement = ({ booking, customer, car: carObj, thumbImageUrl, inkThumbBox }) => {
    const html = rentalAgreementDoc({
      booking,
      customer: customer || {},
      car: carObj || {},
      thumbImageUrl,
      inkThumbBox,
      staffName: booking.staffName || user?.name || '',
    });
    printHtml(html, `Agreement ${booking.number || booking.bookingNumber}`);
  };

  const handleScanThumb = async () => {
    if (!isBrowserOnline()) {
      toast.error('Fingerprint capture requires an internet connection.');
      return;
    }
    setScanning(true);
    try {
      const result = await captureSecuGenThumb();
      setThumbFile(result.file);
      setThumbPreview(result.dataUrl);
      setThumbConsent(false);
      setInkOnly(false);
      toast.success('Thumb scanned successfully');
    } catch (err) {
      toast.error(err?.message || 'Could not capture fingerprint. Check the scanner.');
    } finally {
      setScanning(false);
    }
  };

  const handleManualThumbFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    setThumbFile(file);
    setInkOnly(false);
    const reader = new FileReader();
    reader.onload = () => setThumbPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const finishBioAndPrint = async (saveToCustomer) => {
    const ctx = bioModal;
    if (!ctx) return;

    let thumbUrl = null;
    let useInk = inkOnly;

    if (saveToCustomer && thumbFile && thumbConsent) {
      try {
        await updateCustomer({
          id: ctx.customer?.id || ctx.booking.customerId,
          thumbImage: thumbFile,
          biometricConsent: 'true',
        }).unwrap();
        toast.success('Fingerprint saved to customer record');
        // Prefer the local preview for this print; next time it will come from API
        thumbUrl = thumbPreview;
      } catch (e) {
        toast.error(
          `Could not save fingerprint: ${errorMessage(e)}. Printing with current image only.`
        );
        thumbUrl = thumbPreview;
      }
    } else if (thumbPreview && !inkOnly) {
      thumbUrl = thumbPreview;
    } else {
      useInk = true;
    }

    printAgreement({
      booking: ctx.booking,
      customer: ctx.customer,
      car: ctx.car,
      thumbImageUrl: thumbUrl,
      inkThumbBox: useInk,
    });
    setBioModal(null);
  };

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
          className="card flex items-center gap-1 overflow-x-auto px-3 sm:px-4 py-3 text-xs sm:text-sm"
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
                <span className="w-4 sm:w-6 h-px bg-line mx-0.5 sm:mx-1" />
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
                    <span className="hidden sm:inline">Add New Customer</span>
                    <span className="sm:hidden">Add</span>
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
                <div className="mt-3 rounded-xl border border-line bg-soft p-3 flex flex-wrap gap-3 sm:gap-4 items-center">
                  <Avatar src={cust.photo} name={cust.name} size={56} />
                  <div className="min-w-140 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
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
                        <div className="w-14 h-10 sm:w-16 sm:h-11 rounded-md bg-white border border-line overflow-hidden grid place-items-center">
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
                  <dl className="w-full sm:w-auto sm:ml-auto text-sm grid grid-cols-3 sm:grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
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
                    className="input h-9! pl-8 w-40! sm:w-56!"
                    placeholder="Search car…"
                    value={carSearch}
                    onChange={(e) => setCarSearch(e.target.value)}
                    aria-label="Search cars"
                  />
                </div>
              }
            >
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  ['', 'All', counts?.total],
                  ['Available', 'Available', counts?.available],
                  ['On Rent', 'On Rent', counts?.onRent],
                  ['Under Repair', 'Repair', counts?.repair],
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
                  className="grid gap-3 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 max-h-420 overflow-y-auto p-1"
                  role="radiogroup"
                  aria-label="Cars"
                >

                  {cars.items.map((c) => {
                    const sel = w.carId === c.id;

                    const blocked =
                      c.freeForDates === false ||
                      ['Under Repair', 'Out of Service'].includes(c.status);

                    const selectCar = () => {
                      if (blocked) return;

                      form.setValue('carId', c.id, {
                        shouldValidate: true,
                      });
                    };

                    return (
                      <div
                        key={c.id}
                        role="radio"
                        aria-checked={sel}
                        aria-disabled={blocked}
                        tabIndex={blocked ? -1 : 0}
                        onClick={selectCar}
                        onKeyDown={(e) => {
                          if (blocked || e.target !== e.currentTarget) return;

                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectCar();
                          }
                        }}
                        className={cn(
                          'relative text-left rounded-xl border p-2.5 transition',
                          sel
                            ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                            : 'border-line bg-white hover:border-primary/40',
                          blocked
                            ? 'opacity-55 cursor-not-allowed'
                            : 'cursor-pointer'
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

                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 group">
                            <b className="text-primary text-sm">
                              {formatPKR(c.dailyRate)}
                              <span className="text-[10px] text-muted font-medium">
                                {' '}
                                /day
                              </span>
                            </b>

                            {canEditRate && sel && (
                              <button
                                type="button"
                                className="p-0.5 rounded text-muted hover:text-primary hover:bg-primary/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditRate();
                                }}
                                title="Update car daily rent"
                                aria-label="Edit daily rent"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                          </div>

                          {blocked ? (
                            <span className="badge badge-danger">
                              {['Under Repair', 'Out of Service'].includes(c.status)
                                ? c.status
                                : 'Booked'}
                            </span>
                          ) : (
                            <span className="badge badge-success">
                              {rt.valid ? 'Free' : c.status}
                            </span>
                          )}
                        </div>
                      </div>
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

            {/* 3. Dates – daily only */}
            <SectionCard number={3} title="Pick Up & Return">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="grid grid-cols-[1fr_110px] sm:grid-cols-[1fr_130px] gap-2">
                  <FormDatePicker
                    name="pickupDate"
                    label="Pick Up Date"
                    required
                  />
                  <FormTimePicker name="pickupTime" label="Time" />
                </div>
                <div className="grid grid-cols-[1fr_110px] sm:grid-cols-[1fr_130px] gap-2">
                  <FormDatePicker
                    name="returnDate"
                    label="Return Date"
                    required
                  />
                  <FormTimePicker name="returnTime" label="Time" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 sm:px-4 py-2 text-sm">
                  <span className="text-muted">Rental Period: </span>
                  <b className="text-primary">
                    {rt.valid ? rt.label : 'Choose valid dates'}
                  </b>
                </div>
                <p className="text-xs text-muted">
                  Same-day bookings are allowed when return time is after pick-up. Charged as full day(s).
                </p>
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
                  <FormLocationCombobox
                    name="pickupLocation"
                    label="Pick Up Location"
                    suggestions={locationSuggestions}
                  />
                  <FormLocationCombobox
                    name="returnLocation"
                    label="Return Location"
                    extras={['Same as Pickup']}
                    suggestions={locationSuggestions}
                  />
                  <FormInput
                    name="instructions"
                    as="textarea"
                    label="Special Instructions (Optional)"
                    className="sm:col-span-2"
                    placeholder="Any special instruction…"
                  />
                </div>

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
                          label="Driver rate (per day)"
                          placeholder="0"
                          hint="Charged per day. Multiplied by rental period."
                        />
                        <div className="rounded-xl bg-white border border-line px-3 py-2 text-sm min-w-140">
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
                      className="grid grid-cols-[1fr_110px] sm:grid-cols-[1fr_130px] gap-2 items-center"
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
                    className="w-20 sm:w-24 h-auto"
                  />
                  <div className="min-w-0">
                    <b className="block truncate">{car.name}</b>
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
                  <dd className="font-semibold text-right">
                    {rt.valid ? fmtDateTime(pickupAt) : '-'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Return</dt>
                  <dd className="font-semibold text-right">
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
                <div className="flex justify-between items-center gap-2">
                  <dt className="text-muted">Daily Rent</dt>
                  <dd className="font-semibold flex items-center gap-1.5">
                    {formatPKR(rt.rate)}
                    {canEditRate && car && (
                      <button
                        type="button"
                        className="p-1 rounded-lg text-muted hover:text-primary hover:bg-primary/10"
                        onClick={openEditRate}
                        title="Update car daily rent (affects future bookings)"
                        aria-label="Edit daily rent"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">
                    Total Rent ({rt.valid ? rt.label : '-'})
                  </dt>
                  <dd className="font-semibold">{formatPKR(rt.amount)}</dd>
                </div>

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
                <span className="font-semibold text-sm sm:text-base">Remaining Amount</span>
                <b className="text-lg sm:text-xl text-success">
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
                    label={`Payment Screenshot (${PROOF_REQUIRED.includes(method) ? 'required' : 'optional'
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

      {/* Review modal (unchanged flow) */}
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

      {/* ========== SUCCESS MODAL ========== */}
      <AppModal
        open={!!successBooking}
        onClose={() => { }}
        title="Booking Created Successfully"
        subtitle="Your booking is saved. Print the agreement or start another."
        size="md"
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              type="button"
              className="btn btn-outline flex-1"
              onClick={() => startPrintFlow(successBooking)}
            >
              <Printer size={16} />
              Print Booking
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={resetForNewBooking}
            >
              <Plus size={16} />
              New Booking
            </button>
            <button
              type="button"
              className="btn btn-success flex-1"
              onClick={goToBooking}
            >
              <CircleCheck size={16} />
              OK
            </button>
          </div>
        }
      >
        {successBooking && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-success/10 border border-success/25 p-3">
              <CircleCheck size={28} className="text-success shrink-0" />
              <div>
                <p className="font-bold text-base">
                  {successBooking.number || successBooking.bookingNumber}
                </p>
                <p className="text-xs text-muted">
                  Invoice {successBooking.invoiceNo || successBooking.invoiceNumber || '—'}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-line p-3 space-y-1">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">Customer</p>
                <p className="font-bold">{successBooking.customerName}</p>
                <p className="text-muted">{successBooking.customerMobile}</p>
                {cust?.cnic && <p className="text-xs text-muted">CNIC: {cust.cnic}</p>}
              </div>
              <div className="rounded-xl border border-line p-3 space-y-1">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">Car</p>
                <div className="flex gap-2 items-center">
                  {successBooking.carImage && (
                    <SmartImage
                      src={successBooking.carImage}
                      alt=""
                      width={64}
                      height={40}
                      className="rounded"
                    />
                  )}
                  <div>
                    <p className="font-bold">{successBooking.carName}</p>
                    <p className="text-muted text-xs">{successBooking.carPlate}</p>
                  </div>
                </div>
              </div>
            </div>

            <dl className="text-sm space-y-1.5 rounded-xl bg-soft border border-line p-3">
              <div className="flex justify-between">
                <dt className="text-muted">Pick Up</dt>
                <dd className="font-semibold">{fmtDateTime(successBooking.pickupAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Return</dt>
                <dd className="font-semibold">{fmtDateTime(successBooking.returnAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Duration</dt>
                <dd className="font-semibold">
                  {successBooking.days} day{successBooking.days === 1 ? '' : 's'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Daily rent</dt>
                <dd className="font-semibold">{formatPKR(successBooking.rate)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5">
                <dt className="font-bold">Total Bill</dt>
                <dd className="font-extrabold">{formatPKR(successBooking.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Advance</dt>
                <dd className="font-semibold">
                  {formatPKR(successBooking.paid)}
                  {successBooking.method ? ` (${successBooking.method})` : ''}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Security deposit</dt>
                <dd className="font-semibold">{formatPKR(successBooking.depositPaid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-bold">Remaining</dt>
                <dd className="font-extrabold text-success">
                  {formatPKR(successBooking.balance)}
                </dd>
              </div>
              {successBooking.staffName && (
                <div className="flex justify-between">
                  <dt className="text-muted">Employee</dt>
                  <dd className="font-semibold">{successBooking.staffName}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </AppModal>

      {/* ========== EDIT DAILY RATE MODAL ========== */}
      <AppModal
        open={editRateOpen}
        onClose={() => setEditRateOpen(false)}
        title="Update Car Daily Rent"
        subtitle="This changes the car’s stored default daily rent for future bookings."
        size="sm"
        footer={
          <>
            <button
              className="btn btn-neutral"
              onClick={() => setEditRateOpen(false)}
              disabled={savingRate}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={saveDailyRate}
              disabled={savingRate}
            >
              {savingRate ? 'Saving…' : 'Update Price'}
            </button>
          </>
        }
      >
        {car && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="text-muted">Car: </span>
              <b>
                {car.name} ({car.plate})
              </b>
            </p>
            <p className="text-sm">
              <span className="text-muted">Current Daily Rent: </span>
              <b className="text-primary">{formatPKR(car.dailyRate)}</b>
            </p>
            <label className="block">
              <span className="label">New Daily Rent (Rs.)</span>
              <input
                type="number"
                min={0}
                step={1}
                className="input"
                value={newDailyRate}
                onChange={(e) => setNewDailyRate(e.target.value)}
                placeholder="0"
              />
            </label>
            <p className="text-xs text-muted">
              Existing bookings keep their original agreed rate. Only new
              bookings will use this price.
            </p>
          </div>
        )}
      </AppModal>

      {/* ========== BIOMETRIC SELECTION MODAL ========== */}
      <AppModal
        open={!!bioModal}
        onClose={() => setBioModal(null)}
        title="Add Customer Thumbprint"
        subtitle="Choose how to include the customer’s thumbprint on the rental agreement."
        size="md"
        footer={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              className="btn btn-neutral"
              onClick={() => setBioModal(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-outline flex-1"
              onClick={() => {
                setInkOnly(true);
                setThumbFile(null);
                setThumbPreview(null);
                finishBioAndPrint(false);
              }}
            >
              Print with blank ink box
            </button>
            <button
              className="btn btn-primary flex-1"
              onClick={() => finishBioAndPrint(!!(thumbFile && thumbConsent))}
              disabled={scanning}
            >
              <Printer size={16} />
              {thumbFile && thumbConsent
                ? 'Save & Print'
                : thumbPreview
                  ? 'Print with this image'
                  : 'Print'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Manual upload */}
            <div className="rounded-xl border border-line p-3 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <Upload size={15} /> Manual thumbprint image
              </p>
              <p className="text-xs text-muted">
                Upload an existing scan or photo of an ink thumbprint.
              </p>
              <label className="btn btn-neutral btn-sm w-full cursor-pointer">
                <Upload size={14} />
                Choose image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleManualThumbFile}
                />
              </label>
            </div>

            {/* Scan */}
            <div className="rounded-xl border border-primary/30 bg-primary/0.03 p-3 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2">
                <Fingerprint size={15} className="text-primary" /> Scan with SecuGen
              </p>
              <div className="flex items-center gap-1.5 text-xs">
                {scannerReady === null ? (
                  <span className="text-muted">Checking scanner…</span>
                ) : scannerReady ? (
                  <span className="text-success flex items-center gap-1">
                    <Wifi size={12} /> Scanner ready
                  </span>
                ) : (
                  <span className="text-warning flex items-center gap-1">
                    <WifiOff size={12} /> Scanner not detected
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm w-full"
                onClick={handleScanThumb}
                disabled={scanning || !isBrowserOnline()}
              >
                {scanning ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Scanning…
                  </>
                ) : (
                  <>
                    <Fingerprint size={14} /> Scan Thumb
                  </>
                )}
              </button>
              {!isBrowserOnline() && (
                <p className="text-xs text-danger">
                  Fingerprint capture requires an internet connection.
                </p>
              )}
            </div>
          </div>

          {(thumbPreview || inkOnly) && (
            <div className="flex flex-col sm:flex-row gap-4 items-start rounded-xl border border-line bg-soft p-3">
              <div className="w-24 h-32 rounded-xl border border-line bg-white overflow-hidden grid place-items-center shrink-0">
                {thumbPreview ? (
                  <img
                    src={thumbPreview}
                    alt="Thumb preview"
                    className="size-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-muted text-center px-2">
                    Blank ink box will be printed
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {thumbFile && (
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="size-4 mt-0.5 accent-primary cursor-pointer shrink-0"
                      checked={thumbConsent}
                      onChange={(e) => setThumbConsent(e.target.checked)}
                    />
                    <span className="text-xs leading-snug">
                      Customer has given consent to store this fingerprint image
                      securely for identification purposes. (Required only if
                      you want to save it to the customer record.)
                    </span>
                  </label>
                )}
                <p className="text-xs text-muted">
                  You can print with the image for this agreement only, or save
                  it to the customer for future use (requires consent).
                </p>
              </div>
            </div>
          )}
        </div>
      </AppModal>
    </PermissionGuard>
  );
}
