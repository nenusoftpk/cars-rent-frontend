'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormSelect from '@/components/forms/FormSelect';
import PhoneInput from '@/components/forms/PhoneInput';
import CNICInput from '@/components/forms/CNICInput';
import FormImageUpload from '@/components/forms/FormImageUpload';

import { customerSchema } from '@/validations';
import { CITIES, CUSTOMER_TYPES } from '@/constants';
import {
  useAddCustomerMutation,
  useUpdateCustomerMutation,
} from '@/redux/api/customerApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useAuth } from '@/hooks/useAuth';

const EMPTY = {
  name: '',
  mobile: '',
  address: '',
  city: 'Lahore',
  type: '',
  cnic: '',
  licenseNo: '',
  photo: null,          // File | string (url) | null
  cnicFront: null,
  cnicBack: null,
  licenseImage: null,
  status: 'Active',
};

export default function CustomerFormModal({ open, customer, onClose, onSaved }) {
  const { can } = useAuth();
  const sensitive = can('sensitive:view') || can('customers.documents.view');
  const editing = !!customer?.id;
  const locked = editing && !sensitive;

  const [add, { isLoading: adding }] = useAddCustomerMutation();
  const [update, { isLoading: saving }] = useUpdateCustomerMutation();

  const form = useForm({
    resolver: zodResolver(
      locked ? customerSchema.omit({ cnic: true }) : customerSchema
    ),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      ...EMPTY,
      ...(customer || {}),
      // Keep existing image URLs so the preview still shows
      photo: customer?.photo || null,
      cnicFront: customer?.cnicFront || null,
      cnicBack: customer?.cnicBack || null,
      licenseImage: customer?.licenseImage || null,
      type: customer?.type || '',
      status: customer?.status || 'Active',
      mobile: customer?.mobile || customer?.phone || '',
      licenseNo: customer?.licenseNo || customer?.licenseNumber || '',
    });
  }, [open, customer]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = adding || saving;

  const onSubmit = async (values) => {
    try {
      // FormImageUpload stores either a File or the existing URL string.
      // The API layer only appends real File instances.
      const payload = {
        ...values,
        // backend expects lowercase status
        // Clean the mobile number – remove dashes and spaces
        mobile: String(values.mobile || "").replace(/[\s-]/g, ""),
        status: String(values.status || "Active").toLowerCase(),
      };

      const saved = editing
        ? await update({ id: customer.id, ...payload }).unwrap()
        : await add(payload).unwrap();

      toast.success(
        editing
          ? 'Customer changes saved successfully'
          : 'Customer saved successfully'
      );
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit Customer' : 'Add Customer'}
      subtitle="Fields marked * are required."
      footer={
        <>
          <button
            className="btn btn-neutral"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            form="customer-form"
            type="submit"
            disabled={busy}
          >
            <Save size={16} />
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Save Customer'}
          </button>
        </>
      }
    >
      <Form
        id="customer-form"
        form={form}
        onSubmit={onSubmit}
        className="space-y-5"
      >
        <div className="flex flex-wrap gap-5">
          <FormImageUpload
            name="photo"
            label="Customer Photo"
            round
            width="w-28"
            height="h-28"
            hint="Face clearly visible"
          />

          <div className="flex-1 min-w-[260px] grid sm:grid-cols-2 gap-3 content-start">
            <FormInput
              name="name"
              label="Full Name"
              required
              placeholder="Ahmed Raza"
              className="sm:col-span-2"
            />
            <PhoneInput name="mobile" required />
            <FormSelect
              name="city"
              label="City"
              options={CITIES}
              placeholder="Select city"
            />
          </div>
        </div>

        <FormInput
          name="address"
          label="Home Address"
          required
          placeholder="House 12, Street 4, DHA Phase 5"
        />

        <div className="grid sm:grid-cols-3 gap-3">
          {locked ? (
            <div>
              <label className="label">CNIC Number</label>
              <input
                className="input"
                disabled
                value={customer?.cnic || ''}
                readOnly
              />
              <p className="text-xs text-muted mt-1">
                Hidden – you need permission to change it.
              </p>
            </div>
          ) : (
            <CNICInput name="cnic" required />
          )}

          <FormInput
            name="licenseNo"
            label="Driving Licence Number"
            placeholder="LHR-2019-123456"
            disabled={locked}
          />

          <FormSelect
            name="type"
            label="Customer Type"
            options={CUSTOMER_TYPES}
            placeholder="Normal"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FormImageUpload
            name="cnicFront"
            label="CNIC Front"
            width="w-full"
            height="h-28"
            locked={locked}
          />
          <FormImageUpload
            name="cnicBack"
            label="CNIC Back"
            width="w-full"
            height="h-28"
            locked={locked}
          />
          <FormImageUpload
            name="licenseImage"
            label="Driving Licence Photo"
            width="w-full"
            height="h-28"
            locked={locked}
          />
        </div>
      </Form>
    </AppModal>
  );
}