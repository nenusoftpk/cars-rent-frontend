// PATH: src/features/drivers/DriverFormModal.jsx
'use client';
import { useEffect } from 'react';
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
import PhoneInput from '@/components/forms/PhoneInput';
import MoneyInput from '@/components/forms/MoneyInput';
import FormImageUpload from '@/components/forms/FormImageUpload';
import { useAddDriverMutation, useUpdateDriverMutation } from '@/redux/api/driverApi';
import { errorMessage } from '@/redux/api/baseApi';
import { dayOf } from '@/lib/dates';

/* ---------------- validation ---------------- */
const optNum = z
  .union([z.string(), z.number()])
  .optional()
  .refine(
    (v) => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0),
    'Must be 0 or more'
  );

const driverSchema = z
  .object({
    name: z.string().trim().min(2, 'Driver name is required').max(120),
    phone: z.string().trim().min(1, 'Mobile number is required'),
    email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
    address: z.string().trim().max(500).optional(),
    cnic: z
      .string()
      .trim()
      .regex(/^\d{5}-?\d{7}-?\d$/, 'Enter a valid 13-digit CNIC')
      .or(z.literal(''))
      .optional(),
    licenseNumber: z.string().trim().max(80).optional(),
    licenseExpiry: z.string().optional(),
    salary: optNum,
    paymentType: z.enum(['fixed', 'percentage']),
    paymentRate: optNum,
    status: z.enum(['available', 'inactive']),
    photo: z.any().optional(),
    cnicFront: z.any().optional(),
    cnicBack: z.any().optional(),
    licenseImage: z.any().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.paymentType === 'percentage' && Number(v.paymentRate || 0) > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentRate'],
        message: 'Percentage cannot exceed 100%',
      });
    }
  });

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  address: '',
  cnic: '',
  licenseNumber: '',
  licenseExpiry: '',
  salary: '',
  paymentType: 'fixed',
  paymentRate: '',
  status: 'available',
  photo: '',
  cnicFront: '',
  cnicBack: '',
  licenseImage: '',
};

const PAYMENT_TYPES = [
  { value: 'fixed', label: 'Fixed amount (Rs.) per booking' },
  { value: 'percentage', label: 'Percentage (%) of rental amount' },
];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'inactive', label: 'Inactive' },
];

function fromDriver(d) {
  // Backend returns status as "Active"/"Inactive" and rawStatus as the real enum
  const raw = d.rawStatus || d.status;
  const status =
    raw === 'inactive' || d.status === 'Inactive' ? 'inactive' : 'available';

  return {
    ...EMPTY,
    name: d.name || '',
    phone: d.phone || d.mobile || '',
    email: d.email || '',
    address: d.address || '',
    cnic: d.cnic || '',
    licenseNumber: d.licenseNumber || d.licenseNo || '',
    licenseExpiry: d.licenseExpiry ? dayOf(d.licenseExpiry) : '',
    salary: d.salary ?? '',
    paymentType: d.paymentType || 'fixed',
    paymentRate: d.paymentRate ?? '',
    status,
    // keep existing image URLs so the upload component can show them
    photo: d.photo || '',
    cnicFront: d.cnicFront || '',
    cnicBack: d.cnicBack || '',
    licenseImage: d.licenseImage || '',
  };
}

export default function DriverFormModal({ open, driver, onClose }) {
  const editing = !!driver?.id;
  const isAssigned =
    editing &&
    (driver.rawStatus === 'assigned' || driver.status === 'Assigned');

  const [add, { isLoading: a }] = useAddDriverMutation();
  const [upd, { isLoading: u }] = useUpdateDriverMutation();

  const form = useForm({
    resolver: zodResolver(driverSchema),
    defaultValues: EMPTY,
  });

  const paymentType = form.watch('paymentType');

  useEffect(() => {
    if (!open) return;
    form.reset(editing ? fromDriver(driver) : EMPTY);
  }, [open, driver]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (v) => {
    try {
      const payload = { ...v };

      console.log("DRIVER IMAGE DEBUG:", {
        photo: payload.photo,
        photoIsFile: payload.photo instanceof File,

        cnicFront: payload.cnicFront,
        cnicFrontIsFile: payload.cnicFront instanceof File,

        cnicBack: payload.cnicBack,
        cnicBackIsFile: payload.cnicBack instanceof File,

        licenseImage: payload.licenseImage,
        licenseImageIsFile: payload.licenseImage instanceof File,
      });
      // Never send "assigned" – it is managed by bookings
      if (isAssigned) delete payload.status;

      // Clean empty numbers
      if (payload.salary === '') payload.salary = 0;
      if (payload.paymentRate === '') payload.paymentRate = 0;

      if (editing) {
        await upd({ id: driver.id, ...payload }).unwrap();
      } else {
        await add(payload).unwrap();
      }

      toast.success(editing ? 'Driver updated successfully' : 'Driver created successfully');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Driver' : 'Add Driver'}
      subtitle="Personal details, payment settings and documents."
      footer={
        <>
          <button className="btn btn-neutral" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            form="drv-form"
            type="submit"
            disabled={a || u}
          >
            <Save size={16} />
            {a || u ? 'Saving…' : 'Save Driver'}
          </button>
        </>
      }
    >
      <Form id="drv-form" form={form} onSubmit={submit} className="space-y-5">
        {/* Photo + basic info */}
        <div className="flex gap-4 flex-wrap">
          <FormImageUpload name="photo" label="Driver Photo" round />
          <div className="flex-1 min-w-[220px] space-y-3">
            <FormInput
              name="name"
              label="Driver Name"
              required
              placeholder="Muhammad Asif"
            />
            <PhoneInput name="phone" required />
          </div>
        </div>

        {/* Contact */}
        <div className="grid sm:grid-cols-2 gap-3">
          <FormInput
            name="email"
            label="Email (optional)"
            type="email"
            placeholder="driver@example.com"
          />
          <FormInput
            name="cnic"
            label="CNIC (optional)"
            placeholder="35202-1234567-1"
          />
          <FormInput
            name="address"
            label="Address (optional)"
            className="sm:col-span-2"
            placeholder="House, street, city"
          />
        </div>

        {/* Licence */}
        <div className="grid sm:grid-cols-2 gap-3">
          <FormInput
            name="licenseNumber"
            label="Driving Licence Number"
            placeholder="LHR-2019-123456"
          />
          <FormDatePicker name="licenseExpiry" label="Licence Expiry" />
        </div>

        {/* Payment settings */}
        <div className="rounded-xl border border-line bg-soft/40 p-4 space-y-3">
          <p className="text-sm font-semibold">How is this driver paid?</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <MoneyInput
              name="salary"
              label="Monthly Salary (Rs.)"
              placeholder="0 = no fixed salary"
            />
            <FormSelect
              name="paymentType"
              label="Per-booking payment type"
              options={PAYMENT_TYPES}
              placeholder={null}
            />
            <FormInput
              name="paymentRate"
              label={
                paymentType === 'percentage'
                  ? 'Rate per booking (%)'
                  : 'Rate per booking (Rs.)'
              }
              type="number"
              min="0"
              max={paymentType === 'percentage' ? '100' : undefined}
              placeholder={paymentType === 'percentage' ? 'e.g. 10' : 'e.g. 2000'}
            />
            {isAssigned ? (
              <p className="text-xs text-muted rounded-lg bg-white border border-line px-3 py-2 self-end">
                This driver is currently assigned to a booking. Status will
                return to Available automatically when the booking finishes.
              </p>
            ) : (
              <FormSelect
                name="status"
                label="Status"
                options={STATUS_OPTIONS}
                placeholder={null}
              />
            )}
          </div>
          <p className="text-xs text-muted">
            • Leave <b>Monthly Salary = 0</b> and set a rate → paid per booking
            <br />
            • Set a <b>Monthly Salary</b> and keep rate = 0 → fixed salary
            (record as Salary expense)
          </p>
        </div>

        {/* Documents */}
        <div className="flex gap-4 flex-wrap">
          <FormImageUpload
            name="licenseImage"
            label="Licence Photo"
            width="w-48"
            height="h-28"
          />
          <FormImageUpload
            name="cnicFront"
            label="CNIC Front"
            width="w-48"
            height="h-28"
          />
          <FormImageUpload
            name="cnicBack"
            label="CNIC Back"
            width="w-48"
            height="h-28"
          />
        </div>
      </Form>
    </AppModal>
  );
}