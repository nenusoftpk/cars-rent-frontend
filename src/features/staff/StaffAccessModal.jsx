// PATH: src/features/staff/StaffAccessModal.jsx   (NEW FILE)
// PATCH /employees/:id/permissions   body: { permissions, dataScope }  (both required by updateEmployeePermissionsSchema)
'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormRadioGroup from '@/components/forms/FormRadioGroup';
import PermissionMatrix from './PermissionMatrix';
import { useGetStaffOptionsQuery, useUpdateStaffPermissionsMutation } from '@/redux/api/staffApi';
import { errorMessage } from '@/redux/api/baseApi';

const SCOPES = [
  { value: 'own', label: 'Own records only (created by or assigned to them)' },
  { value: 'business', label: 'All records of the business' },
];

export default function StaffAccessModal({ open, person, onClose }) {
  const { data: opts } = useGetStaffOptionsQuery(undefined, { skip: !open });
  const [save, { isLoading }] = useUpdateStaffPermissionsMutation();
  const form = useForm({ defaultValues: { permissions: [], dataScope: 'own' } });

  useEffect(() => {
    if (open && person) form.reset({ permissions: person.permissions || [], dataScope: person.dataScope || 'own' });
  }, [open, person]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (v) => {
    try {
      await save({ id: person.id, permissions: v.permissions, dataScope: v.dataScope }).unwrap();
      toast.success('Permissions updated successfully');
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
      title="Access & Permissions"
      subtitle={person ? `${person.name} · ${person.email}` : ''}
      footer={
        <>
          <button className="btn btn-neutral" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="staff-access-form" type="submit" disabled={isLoading}>
            <Save size={16} />
            {isLoading ? 'Saving…' : 'Save Access'}
          </button>
        </>
      }
    >
      <Form id="staff-access-form" form={form} onSubmit={submit} className="space-y-4">
        <FormRadioGroup name="dataScope" label="Which records can this employee see?" options={SCOPES} />
        <PermissionMatrix name="permissions" options={opts?.allowedPermissions || []} />
      </Form>
    </AppModal>
  );
}