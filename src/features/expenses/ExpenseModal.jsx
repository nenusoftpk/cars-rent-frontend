// PATH: src/features/expenses/ExpenseModal.jsx   (REPLACE your existing file)
// Used by: src/app/income-expenses/page.jsx
'use client';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import MoneyInput from '@/components/forms/MoneyInput';
import CarSelector from '@/components/forms/CarSelector';
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, categoryOf } from './expenseConstants';
import { useAddExpenseMutation, useUpdateExpenseMutation } from '@/redux/api/expenseApi';
import { useGetDriversQuery } from '@/redux/api/driverApi';
import { idOf as refId } from '@/redux/api/bookingApi';
import { errorMessage } from '@/redux/api/baseApi';
import { toDay, dayOf } from '@/lib/dates';

/* ---------------- validation (mirrors expenseValidation.js) ---------------- */
const optNum = z
  .union([z.string(), z.number()])
  .optional()
  .refine((v) => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Must be 0 or more');

const expenseSchema = z
  .object({
    category: z.string().min(1, 'Select an expense type'),
    expenseDate: z.string().min(1, 'Select a date'),
    title: z.string().trim().min(2, 'Enter at least 2 characters').max(200, 'Maximum 200 characters'),
    amount: z.coerce.number().positive('Enter an amount greater than 0'),
    paymentMethod: z.string().min(1, 'Select a payment method'),
    paidTo: z.string().trim().max(200, 'Maximum 200 characters').optional(),
    description: z.string().trim().max(1500, 'Maximum 1500 characters').optional(),
    carId: z.string().optional(),
    driverId: z.string().optional(),
    workshopName: z.string().trim().max(200, 'Maximum 200 characters').optional(),
    odometer: optNum,
    nextServiceDate: z.string().optional(),
    nextServiceOdometer: optNum,
    nextOilChangeDate: z.string().optional(),
    nextOilChangeOdometer: optNum,
  })
  .superRefine((v, ctx) => {
    const cfg = categoryOf(v.category);
    if (cfg.car === 'required' && !v.carId) ctx.addIssue({ code: 'custom', path: ['carId'], message: 'Select the car' });
    if (cfg.driver && !v.driverId) ctx.addIssue({ code: 'custom', path: ['driverId'], message: 'Select the driver' });
  });

/* ---------------- defaults / prefill ---------------- */
const makeKey = () => globalThis.crypto?.randomUUID?.() ?? `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const dateOrEmpty = (v) => (v ? dayOf(v) : '');
const numOrEmpty = (v) => (v === null || v === undefined ? '' : v);

const emptyForm = () => ({
  category: 'fuel',
  expenseDate: toDay(),
  title: '',
  amount: '',
  paymentMethod: 'cash',
  paidTo: '',
  description: '',
  carId: '',
  driverId: '',
  workshopName: '',
  odometer: '',
  nextServiceDate: '',
  nextServiceOdometer: '',
  nextOilChangeDate: '',
  nextOilChangeOdometer: '',
});

const fromExpense = (e) => ({
  ...emptyForm(),
  category: e.category || 'other',
  expenseDate: dateOrEmpty(e.expenseDate) || toDay(),
  title: e.title || '',
  amount: numOrEmpty(e.amount),
  paymentMethod: e.paymentMethod || 'cash',
  paidTo: e.paidTo || '',
  description: e.description || '',
  carId: refId(e.carId),
  driverId: refId(e.driverId),
  workshopName: e.workshopName || '',
  odometer: numOrEmpty(e.odometer),
  nextServiceDate: dateOrEmpty(e.nextServiceDate),
  nextServiceOdometer: numOrEmpty(e.nextServiceOdometer),
  nextOilChangeDate: dateOrEmpty(e.nextOilChangeDate),
  nextOilChangeOdometer: numOrEmpty(e.nextOilChangeOdometer),
});

/* ---------------- payload: ONLY fields allowed by createExpenseSchema / updateExpenseSchema ---------------- */
const numOrNull = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

function buildPayload(v, { creating, idempotencyKey }) {
  const cfg = categoryOf(v.category);
  const carRelated = cfg.car !== 'none';
  const p = {
    title: v.title.trim(),
    category: v.category,
    amount: Math.round(Number(v.amount) * 100) / 100, // update schema is strict(): must be a number
    paymentMethod: v.paymentMethod,
    expenseDate: v.expenseDate,
    paidTo: (v.paidTo || '').trim(),
    description: (v.description || '').trim(),
    carId: carRelated && v.carId ? v.carId : null,
    driverId: cfg.driver && v.driverId ? v.driverId : null,
    workshopName: carRelated ? (v.workshopName || '').trim() : '',
    odometer: carRelated ? numOrNull(v.odometer) : null,
    nextServiceDate: v.category === 'service' && v.nextServiceDate ? v.nextServiceDate : null,
    nextServiceOdometer: v.category === 'service' ? numOrNull(v.nextServiceOdometer) : null,
    nextOilChangeDate: v.category === 'oil_change' && v.nextOilChangeDate ? v.nextOilChangeDate : null,
    nextOilChangeOdometer: v.category === 'oil_change' ? numOrNull(v.nextOilChangeOdometer) : null,
  };
  if (creating) {
    // nothing to clear on a new record - send only what has a value
    const out = Object.fromEntries(Object.entries(p).filter(([, x]) => x !== null && x !== ''));
    out.idempotencyKey = idempotencyKey; // create only (not allowed on update)
    return out;
  }
  return p; // update: nulls/empties are sent so old values can be cleared
}

export default function ExpenseModal({ open, expense, onClose }) {
  const editing = !!expense?.id;
  const [add, { isLoading: a }] = useAddExpenseMutation();
  const [upd, { isLoading: u }] = useUpdateExpenseMutation();
  const keyRef = useRef(makeKey());

  const form = useForm({ resolver: zodResolver(expenseSchema), defaultValues: emptyForm() });
  const category = form.watch('category');
  const cfg = categoryOf(category);
  const carRelated = cfg.car !== 'none';

  const { data: drivers } = useGetDriversQuery({ pageSize: 100 }, { skip: !open || !cfg.driver });
  const driverOptions = (drivers?.items || []).map((d) => ({ value: d.id, label: `${d.name} (${d.phone})` }));

  useEffect(() => {
    if (!open) return;
    keyRef.current = makeKey(); // a fresh idempotency key for every new "Add Expense" session
    form.reset(editing ? fromExpense(expense) : emptyForm());
  }, [open, expense]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (v) => {
    try {
      const payload = buildPayload(v, { creating: !editing, idempotencyKey: keyRef.current });
      if (editing) await upd({ id: expense.id, ...payload }).unwrap();
      else await add(payload).unwrap();
      toast.success(editing ? 'Expense changes saved successfully' : 'Expense saved successfully');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Expense' : 'Add Expense'}
      subtitle="Fuel, repairs, servicing, salaries and other business expenses."
      footer={
        <>
          <button className="btn btn-neutral" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="exp-form" disabled={a || u}>
            <Save size={16} />
            {a || u ? 'Saving…' : 'Save Expense'}
          </button>
        </>
      }
    >
      <Form id="exp-form" form={form} onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        <FormSelect
          name="category"
          label="Expense Type"
          required
          options={EXPENSE_CATEGORIES.map(({ value, label }) => ({ value, label }))}
          placeholder={null}
        />
        <FormDatePicker name="expenseDate" label="Date" required />

        {carRelated ? (
          <CarSelector
            name="carId"
            label={cfg.car === 'required' ? 'Car' : 'Car (optional)'}
            required={cfg.car === 'required'}
            className="sm:col-span-2"
          />
        ) : (
          <p className="sm:col-span-2 text-xs text-muted rounded-lg bg-soft px-3 py-2">
            This is a general business expense. It is not linked to any one car.
          </p>
        )}

        {cfg.driver && (
          <FormSelect name="driverId" label="Driver" required options={driverOptions} placeholder="Select driver" className="sm:col-span-2" />
        )}

        <FormInput name="title" label="Details" required placeholder="e.g. Petrol for Corolla" className="sm:col-span-2" />
        <FormInput name="paidTo" label="Paid To (shop / person)" placeholder="e.g. PSO Gulberg" />
        <FormSelect name="paymentMethod" label="Payment Method" required options={EXPENSE_METHODS} placeholder={null} />
        <MoneyInput name="amount" label="Amount" required />

        {carRelated && (
          <>
            <FormInput name="workshopName" label="Workshop (optional)" placeholder="e.g. Ali Autos, Ferozepur Road" />
            <FormInput name="odometer" label="Odometer (km, optional)" type="number" min="0" placeholder="e.g. 84500" />
          </>
        )}

        {category === 'service' && (
          <>
            <FormDatePicker name="nextServiceDate" label="Next Service Date" />
            <FormInput name="nextServiceOdometer" label="Next Service at (km)" type="number" min="0" />
          </>
        )}
        {category === 'oil_change' && (
          <>
            <FormDatePicker name="nextOilChangeDate" label="Next Oil Change Date" />
            <FormInput name="nextOilChangeOdometer" label="Next Oil Change at (km)" type="number" min="0" />
          </>
        )}

        <FormInput name="description" label="Notes (optional)" placeholder="Anything else worth remembering" className="sm:col-span-2" />
      </Form>
    </AppModal>
  );
}