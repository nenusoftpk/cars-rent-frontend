// PATH: src/features/staff/StaffFormModal.jsx   (REPLACE your existing file)
// Create: name, email, phone, password, photo, dataScope, permissions  (POST /employees)
// Edit:   name, phone, photo only                                      (PATCH /employees/:id)
// Status, permissions and password have their own actions - see StaffAccessModal / StaffPasswordModal.
'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormRadioGroup from '@/components/forms/FormRadioGroup';
import PhoneInput from '@/components/forms/PhoneInput';
import FormImageUpload from '@/components/forms/FormImageUpload';
import PermissionMatrix from './PermissionMatrix';
import { useAddStaffMutation, useUpdateStaffMutation, useGetStaffOptionsQuery } from '@/redux/api/staffApi';
import { errorMessage } from '@/redux/api/baseApi';

/* mirrors employeeValidation.js */
const base = {
  name: z.string().trim().min(2, 'Name must contain at least 2 characters').max(120, 'Maximum 120 characters'),
  phone: z.string().trim().optional(),
  photo: z.any().optional(),
};
const createSchema = z.object({
  ...base,
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(10, 'Password must contain at least 10 characters').max(128, 'Password cannot exceed 128 characters'),
  dataScope: z.enum(['own', 'business']),
  permissions: z.array(z.string()),
});
const editSchema = z.object({ ...base, email: z.string().optional() });

const EMPTY = { name: '', email: '', phone: '', password: '', photo: '', dataScope: 'own', permissions: [] };
const SCOPES = [
  { value: 'own', label: 'Own records only (created by or assigned to them)' },
  { value: 'business', label: 'All records of the business' },
];

export default function StaffFormModal({ open, person, onClose }) {
  const editing = !!person?.id;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const [add, { isLoading: a }] = useAddStaffMutation();
  const [upd, { isLoading: u }] = useUpdateStaffMutation();
  const { data: opts } = useGetStaffOptionsQuery(undefined, { skip: !open || editing });

  const resolver = useCallback((v, c, o) => zodResolver(editingRef.current ? editSchema : createSchema)(v, c, o), []);
  const form = useForm({ resolver, defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? { ...EMPTY, name: person.name || '', email: person.email || '', phone: person.phone || '', photo: person.photo || '' }
        : { ...EMPTY, permissions: opts?.defaultEmployeePermissions || [] }
    );
  }, [open, person]); // eslint-disable-line react-hooks/exhaustive-deps

  // permission defaults arrive from the server - apply them once if the user has not touched the matrix
  useEffect(() => {
    if (open && !editing && opts?.defaultEmployeePermissions && !form.formState.dirtyFields.permissions) {
      form.setValue('permissions', opts.defaultEmployeePermissions);
    }
  }, [open, editing, opts]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (v) => {
    try {
      if (editing) await upd({ id: person.id, name: v.name, phone: v.phone, photo: v.photo }).unwrap();
      else await add(v).unwrap();
      toast.success(editing ? 'User changes saved successfully' : 'User saved successfully');
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
      title={editing ? 'Edit User' : 'Add User'}
      footer={
        <>
          <button className="btn btn-neutral" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="staff-form" type="submit" disabled={a || u}>
            <Save size={16} />
            {a || u ? 'Saving…' : 'Save User'}
          </button>
        </>
      }
    >
      <Form id="staff-form" form={form} onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <FormImageUpload name="photo" label="Photo" round />
          <div className="flex-1 min-w-[240px] grid sm:grid-cols-2 gap-3 content-start">
            <FormInput name="name" label="Full Name" required className="sm:col-span-2" />
            {editing ? (
              <div className="sm:col-span-2">
                <label className="label">Email (used to log in)</label>
                <p className="input flex items-center bg-soft text-muted">{person.email}</p>
              </div>
            ) : (
              <FormInput name="email" label="Email (used to log in)" required type="email" autoComplete="off" className="sm:col-span-2" />
            )}
            <PhoneInput name="phone" />
            {!editing && <FormInput name="password" label="Password (min 10 characters)" required type="password" autoComplete="new-password" />}
          </div>
        </div>

        {editing ? (
          <p className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm">
            To change what this user can do, use <b>Access &amp; Permissions</b>. To block or unblock the login, use <b>Disable / Enable</b>.
          </p>
        ) : (
          <>
            <FormRadioGroup name="dataScope" label="Which records can this employee see?" options={SCOPES} />
            <div>
              <h4 className="font-bold mb-2">What can this employee do?</h4>
              <PermissionMatrix name="permissions" options={opts?.allowedPermissions || []} />
            </div>
          </>
        )}
      </Form>
    </AppModal>
  );
}