// PATH: src/features/staff/StaffPasswordModal.jsx   (NEW FILE)
// POST /employees/:id/reset-password   body: { newPassword }  (min 10, max 128). All of that user's sessions are revoked.
'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import { useResetStaffPasswordMutation } from '@/redux/api/staffApi';
import { errorMessage } from '@/redux/api/baseApi';

const schema = z
  .object({
    newPassword: z.string().min(10, 'Password must contain at least 10 characters').max(128, 'Password cannot exceed 128 characters'),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
  });

export default function StaffPasswordModal({ open, person, onClose }) {
  const [reset, { isLoading }] = useResetStaffPasswordMutation();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { newPassword: '', confirmPassword: '' } });

  useEffect(() => {
    if (open) form.reset({ newPassword: '', confirmPassword: '' });
  }, [open, person]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (v) => {
    try {
      await reset({ id: person.id, newPassword: v.newPassword }).unwrap();
      toast.success('Password reset. The user must log in again.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Reset Password"
      subtitle={person ? `${person.name} · ${person.email}` : ''}
      footer={
        <>
          <button className="btn btn-neutral" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="staff-password-form" type="submit" disabled={isLoading}>
            <KeyRound size={16} />
            {isLoading ? 'Saving…' : 'Reset Password'}
          </button>
        </>
      }
    >
      <Form id="staff-password-form" form={form} onSubmit={submit} className="space-y-3">
        <FormInput name="newPassword" label="New Password (min 10 characters)" type="password" required autoComplete="new-password" />
        <FormInput name="confirmPassword" label="Confirm New Password" type="password" required autoComplete="new-password" />
        <p className="text-xs text-muted">The user is signed out of every device and must log in with this new password.</p>
      </Form>
    </AppModal>
  );
}