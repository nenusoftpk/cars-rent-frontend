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
import FormDatePicker from '@/components/forms/FormDatePicker';
import MoneyInput from '@/components/forms/MoneyInput';

import { serviceSchema } from '@/validations';
import { PAYMENT_METHODS } from '@/constants';
import { useAddServiceRecordMutation } from '@/redux/api/carApi';
import { errorMessage } from '@/redux/api/baseApi';
import { toDay } from '@/lib/dates';

export default function ServiceRecordModal({ open, car, onClose }) {
  const [add, { isLoading }] = useAddServiceRecordMutation();

  const form = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      category: 'Service',
      date: toDay(),
      details: '',
      amount: '',
      method: 'Cash',
      supplier: '',
      odometer: '',
      nextDue: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        category: 'Service',
        date: toDay(),
        details: '',
        amount: '',
        method: 'Cash',
        supplier: '',
        odometer: car?.odometer ?? '',
        nextDue: '',
      });
    }
  }, [open, car]); // eslint-disable-line react-hooks/exhaustive-deps

  const cat = form.watch('category');

  const onSubmit = async (v) => {
    try {
      await add({ id: car.id, ...v }).unwrap();
      toast.success('Service record saved successfully');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Add Service Record"
      subtitle={car ? `${car.name} (${car.plate})` : ''}
      footer={
        <>
          <button className="btn btn-neutral" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            form="service-form"
            type="submit"
            disabled={isLoading}
          >
            <Save size={16} />
            {isLoading ? 'Saving…' : 'Save Record'}
          </button>
        </>
      }
    >
      <Form
        id="service-form"
        form={form}
        onSubmit={onSubmit}
        className="grid sm:grid-cols-2 gap-3"
      >
        <FormSelect
          name="category"
          label="What was done?"
          required
          options={['Service', 'Oil Change', 'Repair']}
          placeholder={null}
        />
        <FormDatePicker name="date" label="Date" required />
        <FormInput
          name="details"
          label="Details"
          required
          placeholder="e.g. Brake pads changed"
          className="sm:col-span-2"
        />
        <MoneyInput name="amount" label="Cost" required />
        <FormSelect
          name="method"
          label="Paid By"
          required
          options={PAYMENT_METHODS}
          placeholder={null}
        />
        <FormInput
          name="supplier"
          label="Workshop / Shop"
          placeholder="Auto Care Lahore"
        />
        <FormInput
          name="odometer"
          label="Meter Reading (km)"
          type="number"
        />
        {['Service', 'Oil Change'].includes(cat) && (
          <FormDatePicker
            name="nextDue"
            label={`Next ${cat === 'Service' ? 'Service' : 'Oil Change'} Date`}
            hint="Creates a reminder"
          />
        )}
      </Form>
    </AppModal>
  );
}