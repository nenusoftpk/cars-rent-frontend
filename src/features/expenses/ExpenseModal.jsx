// PATH: src/features/expenses/ExpenseModal.jsx
'use client';
import { useEffect, useRef, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Save,
  ArrowLeft,
  Fuel,
  Wrench,
  Car,
  User,
  Wallet,
  Building2,
  FileText,
  Shield,
  Receipt,
} from 'lucide-react';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import MoneyInput from '@/components/forms/MoneyInput';
import CarSelector from '@/components/forms/CarSelector';
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, categoryOf } from './expenseConstants';
import {
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useGetDriverBookingBalanceQuery,
} from '@/redux/api/expenseApi';
import { useGetDriversQuery, useGetDriverBookingsQuery } from '@/redux/api/driverApi';
import { idOf as refId } from '@/redux/api/bookingApi';
import { errorMessage } from '@/redux/api/baseApi';
import { toDay, dayOf } from '@/lib/dates';
import { formatPKR } from '@/lib/money';

/* ------------------------------------------------------------------ */
/* Icons                                                              */
/* ------------------------------------------------------------------ */
const TYPE_ICONS = {
  fuel: Fuel,
  repair: Wrench,
  service: Wrench,
  oil_change: Fuel,
  tyres: Car,
  brakes: Car,
  inspection: Car,
  insurance: Shield,
  tax: FileText,
  insurance_tax: Shield,
  driver_payment: User,
  salary: Wallet,
  rent: Building2,
  utilities: Building2,
  office_expense: Building2,
  other: Receipt,
};

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */
const optNum = z
  .union([z.string(), z.number()])
  .optional()
  .refine(
    (v) => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0),
    'Must be 0 or more'
  );

const expenseSchema = z
  .object({
    category: z.string().min(1, 'Select an expense type'),
    expenseDate: z.string().min(1, 'Select a date'),
    title: z.string().trim().min(2, 'Enter at least 2 characters').max(200),
    amount: z.coerce.number().positive('Enter an amount greater than 0'),
    paymentMethod: z.string().min(1, 'Select a payment method'),
    paidTo: z.string().trim().max(200).optional(),
    description: z.string().trim().max(1500).optional(),
    carId: z.string().optional(),
    driverId: z.string().optional(),          // used for both driver_payment & salary (UI only for salary)
    bookingId: z.string().optional(),
    workshopName: z.string().trim().max(200).optional(),
    odometer: optNum,
    nextServiceDate: z.string().optional(),
    nextServiceOdometer: optNum,
    nextOilChangeDate: z.string().optional(),
    nextOilChangeOdometer: optNum,
  })
  .superRefine((v, ctx) => {
    const cfg = categoryOf(v.category);

    if (cfg.car === 'required' && !v.carId) {
      ctx.addIssue({ code: 'custom', path: ['carId'], message: 'Select the car' });
    }

    // Driver Payment → driver + booking required
    if (cfg.driver) {
      if (!v.driverId) {
        ctx.addIssue({ code: 'custom', path: ['driverId'], message: 'Select the driver' });
      }
      if (!v.bookingId) {
        ctx.addIssue({ code: 'custom', path: ['bookingId'], message: 'Select the booking' });
      }
    }

    // Salary → driver required (we only put the name into paidTo)
    if (v.category === 'salary' && !v.driverId) {
      ctx.addIssue({ code: 'custom', path: ['driverId'], message: 'Select the driver' });
    }
  });

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const makeKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const dateOrEmpty = (v) => (v ? dayOf(v) : '');
const numOrEmpty = (v) => (v === null || v === undefined ? '' : v);

const emptyForm = (category = 'fuel') => ({
  category,
  expenseDate: toDay(),
  title: '',
  amount: '',
  paymentMethod: 'cash',
  paidTo: '',
  description: '',
  carId: '',
  driverId: '',
  bookingId: '',
  workshopName: '',
  odometer: '',
  nextServiceDate: '',
  nextServiceOdometer: '',
  nextOilChangeDate: '',
  nextOilChangeOdometer: '',
});

const fromExpense = (e) => ({
  ...emptyForm(e.category),
  category: e.category || 'other',
  expenseDate: dateOrEmpty(e.expenseDate) || toDay(),
  title: e.title || '',
  amount: numOrEmpty(e.amount),
  paymentMethod: e.paymentMethod || 'cash',
  paidTo: e.paidTo || '',
  description: e.description || '',
  carId: refId(e.carId),
  driverId: refId(e.driverId),
  bookingId: refId(e.bookingId),
  workshopName: e.workshopName || '',
  odometer: numOrEmpty(e.odometer),
  nextServiceDate: dateOrEmpty(e.nextServiceDate),
  nextServiceOdometer: numOrEmpty(e.nextServiceOdometer),
  nextOilChangeDate: dateOrEmpty(e.nextOilChangeDate),
  nextOilChangeOdometer: numOrEmpty(e.nextOilChangeOdometer),
});

const numOrNull = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

function buildPayload(v, { creating, idempotencyKey }) {
  const cfg = categoryOf(v.category);
  const carRelated = cfg.car !== 'none';
  const isDriverPay = cfg.driver === true; // only true for driver_payment

  const p = {
    title: v.title.trim(),
    category: v.category,
    amount: Math.round(Number(v.amount) * 100) / 100,
    paymentMethod: v.paymentMethod,
    expenseDate: v.expenseDate,
    paidTo: (v.paidTo || '').trim(),
    description: (v.description || '').trim(),
    carId: carRelated && v.carId ? v.carId : null,

    // Backend currently only allows driverId on driver_payment
    driverId: isDriverPay && v.driverId ? v.driverId : null,
    bookingId: isDriverPay && v.bookingId ? v.bookingId : null,

    workshopName: carRelated ? (v.workshopName || '').trim() : '',
    odometer: carRelated ? numOrNull(v.odometer) : null,
    nextServiceDate: v.category === 'service' && v.nextServiceDate ? v.nextServiceDate : null,
    nextServiceOdometer: v.category === 'service' ? numOrNull(v.nextServiceOdometer) : null,
    nextOilChangeDate: v.category === 'oil_change' && v.nextOilChangeDate ? v.nextOilChangeDate : null,
    nextOilChangeOdometer: v.category === 'oil_change' ? numOrNull(v.nextOilChangeOdometer) : null,
  };

  if (creating) {
    const out = Object.fromEntries(Object.entries(p).filter(([, x]) => x !== null && x !== ''));
    out.idempotencyKey = idempotencyKey;
    return out;
  }
  return p;
}

/* ------------------------------------------------------------------ */
/* Type groups                                                        */
/* ------------------------------------------------------------------ */
const TYPE_GROUPS = [
  {
    title: 'Vehicle & Maintenance',
    items: ['fuel', 'repair', 'service', 'oil_change', 'tyres', 'brakes', 'inspection'],
  },
  {
    title: 'Driver Payments',
    items: ['driver_payment', 'salary'],
  },
  {
    title: 'Business & Admin',
    items: ['insurance', 'tax', 'insurance_tax', 'rent', 'utilities', 'office_expense', 'other'],
  },
];

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export default function ExpenseModal({ open, expense, onClose }) {
  const editing = !!expense?.id;
  const [step, setStep] = useState(editing ? 'form' : 'type');
  const [add, { isLoading: a }] = useAddExpenseMutation();
  const [upd, { isLoading: u }] = useUpdateExpenseMutation();
  const keyRef = useRef(makeKey());

  const form = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: emptyForm(),
  });

  const category = form.watch('category');
  const driverId = form.watch('driverId');
  const bookingId = form.watch('bookingId');

  const cfg = categoryOf(category);
  const carRelated = cfg.car !== 'none';
  const isDriverPay = !!cfg.driver;          // driver_payment only
  const isSalary = category === 'salary';
  const isMaintenance = ['repair', 'service', 'oil_change', 'tyres', 'brakes', 'inspection'].includes(category);
  const isFuel = category === 'fuel';

  // ---------- Drivers list (we always fetch when salary or driver_payment) ----------
  const needDrivers = open && (isDriverPay || isSalary);
  const { data: driversData } = useGetDriversQuery(
    { pageSize: 100 },
    { skip: !needDrivers }
  );

  // Split drivers by payment mode
  const { salaryDrivers, perBookingDrivers } = useMemo(() => {
    const list = driversData?.items || [];
    const salary = [];
    const perBooking = [];

    for (const d of list) {
      const isSalaryMode =
        d.paymentMode === 'salary' ||
        (Number(d.salary) > 0 && Number(d.paymentRate || 0) === 0);

      if (isSalaryMode) salary.push(d);
      else perBooking.push(d);
    }
    return { salaryDrivers: salary, perBookingDrivers: perBooking };
  }, [driversData]);

  const driverOptions = useMemo(() => {
    const source = isSalary ? salaryDrivers : perBookingDrivers;
    return source.map((d) => ({
      value: d.id,
      label: `${d.name} (${d.phone})`,
    }));
  }, [isSalary, salaryDrivers, perBookingDrivers]);

  // Bookings of selected driver (only for driver_payment)
  const { data: driverBookings, isFetching: loadingBookings } = useGetDriverBookingsQuery(
    { id: driverId, pageSize: 50 },
    { skip: !open || !isDriverPay || !driverId }
  );

  const bookingOptions = useMemo(() => {
    return (driverBookings?.items || [])
      .filter((b) => String(b.status || '').toLowerCase() !== 'cancelled')
      .map((b) => ({
        value: b.id,
        label: `${b.number || b.bookingNumber} · ${b.carName || 'Car'} · ${b.customerName || ''}`.trim(),
      }));
  }, [driverBookings]);

  // Live balance (driver_payment only)
  const { data: balance } = useGetDriverBookingBalanceQuery(bookingId, {
    skip: !open || !isDriverPay || !bookingId,
  });

  // Prefill when balance arrives
  useEffect(() => {
    if (!isDriverPay || !balance || editing) return;
    if (balance.remaining > 0) {
      form.setValue('amount', balance.remaining, { shouldValidate: true });
    }
    if (balance.driverName && !form.getValues('paidTo')) {
      form.setValue('paidTo', balance.driverName);
    }
    if (!form.getValues('title')) {
      form.setValue('title', `Driver payment – ${balance.bookingNumber || ''}`);
    }
  }, [balance, isDriverPay, editing]); // eslint-disable-line

  // When a salary driver is selected → fill paidTo + title
  useEffect(() => {
    if (!isSalary || !driverId) return;
    const driver = salaryDrivers.find((d) => d.id === driverId);
    if (!driver) return;

    if (!form.getValues('paidTo')) {
      form.setValue('paidTo', driver.name);
    }
    if (!form.getValues('title')) {
      form.setValue('title', `Salary – ${driver.name}`);
    }
  }, [driverId, isSalary, salaryDrivers]); // eslint-disable-line

  // Clear booking when driver changes (driver_payment)
  useEffect(() => {
    if (isDriverPay) form.setValue('bookingId', '');
  }, [driverId]); // eslint-disable-line

  // Reset on open
  useEffect(() => {
    if (!open) return;
    keyRef.current = makeKey();
    if (editing) {
      form.reset(fromExpense(expense));
      setStep('form');
    } else {
      form.reset(emptyForm());
      setStep('type');
    }
  }, [open, expense]); // eslint-disable-line

  const selectType = (value) => {
    form.reset(emptyForm(value));
    setStep('form');
  };

  const goBackToTypes = () => {
    if (editing) return;
    form.reset(emptyForm());
    setStep('type');
  };

  const submit = async (v) => {
    try {
      const payload = buildPayload(v, {
        creating: !editing,
        idempotencyKey: keyRef.current,
      });
      if (editing) await upd({ id: expense.id, ...payload }).unwrap();
      else await add(payload).unwrap();
      toast.success(editing ? 'Expense updated' : 'Expense saved');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  /* -------------------- TYPE PICKER -------------------- */
  if (step === 'type') {
    return (
      <AppModal
        open={open}
        onClose={onClose}
        title="Add Expense"
        subtitle="Choose the type of expense you want to record"
        footer={
          <button className="btn btn-neutral" type="button" onClick={onClose}>
            Cancel
          </button>
        }
      >
        <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
          {TYPE_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                {group.title}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {group.items.map((value) => {
                  const item = EXPENSE_CATEGORIES.find((c) => c.value === value);
                  if (!item) return null;
                  const Icon = TYPE_ICONS[value] || Receipt;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectType(value)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white hover:border-primary hover:bg-primary/5 px-3 py-4 transition text-center"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Icon size={20} />
                      </div>
                      <span className="text-sm font-medium leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </AppModal>
    );
  }

  /* -------------------- FORM -------------------- */
  const typeLabel = categoryOf(category).label;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Expense' : typeLabel}
      subtitle={
        editing
          ? 'Update the expense details'
          : 'Fill only the fields that apply to this expense type'
      }
      footer={
        <>
          {!editing && (
            <button className="btn btn-neutral" type="button" onClick={goBackToTypes}>
              <ArrowLeft size={16} />
              Change Type
            </button>
          )}
          <button className="btn btn-neutral" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="submit"
            form="exp-form"
            disabled={a || u}
          >
            <Save size={16} />
            {a || u ? 'Saving…' : 'Save Expense'}
          </button>
        </>
      }
    >
      <Form id="exp-form" form={form} onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        {/* Always */}
        <FormDatePicker name="expenseDate" label="Date" required />
        <FormSelect
          name="paymentMethod"
          label="Payment Method"
          required
          options={EXPENSE_METHODS}
          placeholder={null}
        />

        {/* Car */}
        {carRelated && (
          <CarSelector
            name="carId"
            label={cfg.car === 'required' ? 'Car' : 'Car (optional)'}
            required={cfg.car === 'required'}
            className="sm:col-span-2"
          />
        )}

        {/* ---------- DRIVER PAYMENT (per-booking drivers only) ---------- */}
        {isDriverPay && (
          <>
            <FormSelect
              name="driverId"
              label="Driver (per-booking)"
              required
              options={driverOptions}
              placeholder={
                perBookingDrivers.length
                  ? 'Select driver'
                  : 'No per-booking drivers found'
              }
              className="sm:col-span-2"
            />
            <FormSelect
              name="bookingId"
              label="Booking"
              required
              options={bookingOptions}
              placeholder={
                loadingBookings
                  ? 'Loading bookings…'
                  : driverId
                    ? 'Select booking'
                    : 'Select driver first'
              }
              disabled={!driverId || loadingBookings}
              className="sm:col-span-2"
            />
            {balance && (
              <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <span>
                    Payable: <b>{formatPKR(balance.payable)}</b>
                  </span>
                  <span>
                    Already paid: <b>{formatPKR(balance.paid)}</b>
                  </span>
                  <span className="text-primary">
                    Remaining: <b>{formatPKR(balance.remaining)}</b>
                  </span>
                </div>
                {balance.remaining <= 0 && (
                  <p className="mt-1.5 text-danger font-medium">
                    This booking is fully paid. You cannot add more.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ---------- SALARY (salary-based drivers only) ---------- */}
        {isSalary && (
          <FormSelect
            name="driverId"
            label="Driver (salary-based)"
            required
            options={driverOptions}
            placeholder={
              salaryDrivers.length
                ? 'Select salary driver'
                : 'No salary-based drivers found'
            }
            className="sm:col-span-2"
          />
        )}

        {/* Details */}
        <FormInput
          name="title"
          label="Details"
          required
          placeholder={
            isDriverPay
              ? 'e.g. Driver payment for booking BK-123'
              : isSalary
                ? 'e.g. November salary – Ahmad'
                : isFuel
                  ? 'e.g. Petrol for Corolla'
                  : 'e.g. What was paid for'
          }
          className="sm:col-span-2"
        />

        {/* Paid To */}
        <FormInput
          name="paidTo"
          label={isDriverPay || isSalary ? 'Paid To (driver name)' : 'Paid To (shop / person)'}
          placeholder={
            isDriverPay || isSalary ? 'Driver name' : 'e.g. PSO Gulberg / Ali Autos'
          }
        />

        <MoneyInput name="amount" label="Amount" required />

        {/* Fuel / Maintenance extras */}
        {(isFuel || isMaintenance) && (
          <>
            <FormInput
              name="workshopName"
              label="Workshop / Pump (optional)"
              placeholder="e.g. Ali Autos, Ferozepur Road"
            />
            <FormInput
              name="odometer"
              label="Odometer (km, optional)"
              type="number"
              min="0"
              placeholder="e.g. 84500"
            />
          </>
        )}

        {category === 'service' && (
          <>
            <FormDatePicker name="nextServiceDate" label="Next Service Date" />
            <FormInput
              name="nextServiceOdometer"
              label="Next Service at (km)"
              type="number"
              min="0"
            />
          </>
        )}

        {category === 'oil_change' && (
          <>
            <FormDatePicker name="nextOilChangeDate" label="Next Oil Change Date" />
            <FormInput
              name="nextOilChangeOdometer"
              label="Next Oil Change at (km)"
              type="number"
              min="0"
            />
          </>
        )}

        <FormInput
          name="description"
          label="Notes (optional)"
          placeholder="Anything else worth remembering"
          className="sm:col-span-2"
        />

        <input type="hidden" {...form.register('category')} />
      </Form>
    </AppModal>
  );
}