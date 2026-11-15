'use client';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import AppModal from '@/components/modals/AppModal';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormImageUpload from '@/components/forms/FormImageUpload';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import MoneyInput from '@/components/forms/MoneyInput';
import PaymentMethodPicker from '@/features/bookings/PaymentMethodPicker';
import { paymentSchema } from '@/validations';
import { useGetBookingsQuery, useGetBookingQuery, payMethod } from '@/redux/api/bookingApi';
import { useAddPaymentMutation } from '@/redux/api/paymentApi';
import { errorMessage } from '@/redux/api/baseApi';
import { formatPKR } from '@/lib/money';
import { toDay } from '@/lib/dates';
import { uid } from '@/lib/utils';
import { printHtml, receiptDoc } from '@/lib/printTemplates';

// the screenshot may be a File, a Blob, a { file } wrapper or a data:/blob: preview string
const toBlob = async (v) => {
  if (v instanceof Blob) return v;
  if (v?.file instanceof Blob) return v.file;
  const src = typeof v === 'string' ? v : v?.preview || v?.url || '';
  if (/^(data|blob):/i.test(src)) { try { return await (await fetch(src)).blob(); } catch { return null; } }
  return null;
};
const PROOF_REQUIRED = ['bank', 'jazzcash', 'easypaisa']; // backend: screenshot mandatory; cash must have none

// mode: 'payment' (rent / deposit received) | 'refund' (give back security deposit)
export default function PaymentModal({ open, onClose, bookingId = '', mode = 'payment' }) {
  const refund = mode === 'refund'; const reqId = useRef(uid('pay'));
  const [add, { isLoading }] = useAddPaymentMutation();
  const form = useForm({ resolver: zodResolver(paymentSchema), defaultValues: { bookingId, amount: '', method: 'Cash', type: refund ? 'Deposit Refund' : 'Partial', date: toDay(), note: '', paymentProof: null } });
  useEffect(() => { if (open) { reqId.current = uid('pay'); form.reset({ bookingId, amount: '', method: 'Cash', type: refund ? 'Deposit Refund' : 'Partial', date: toDay(), note: '', paymentProof: null }); } }, [open, bookingId, refund]); // eslint-disable-line react-hooks/exhaustive-deps
  const id = form.watch('bookingId'); const type = form.watch('type'); const methodEnum = payMethod(form.watch('method')); const showProof = !!methodEnum && methodEnum !== 'cash';
  const { data: list } = useGetBookingsQuery({ pageSize: 100 }, { skip: !open });
  const { data: b } = useGetBookingQuery(id, { skip: !id || !open });
  const options = (list?.items || []).filter((x) => x.status !== 'Cancelled' && (refund ? x.depositHeld > 0 && ['Completed', 'Cancelled'].includes(x.status) : x.balance > 0 || x.id === bookingId)).map((x) => ({ value: x.id, label: `${x.number} - ${x.customerName} - ${refund ? `deposit held ${formatPKR(x.depositHeld)}` : `balance ${formatPKR(x.balance)}`}` }));
  // Security deposit can only be received up to the amount set on the booking
  const max = refund ? b?.depositHeld : type === 'Security Deposit' ? Math.max((b?.securityDeposit || 0) - (b?.depositPaid || 0), 0) : b?.balance;
  const submit = async (v) => {
    if (refund && b && !['Completed', 'Cancelled'].includes(b.status)) { form.setError('bookingId', { message: 'A deposit can be refunded only after the booking is completed or cancelled.' }); return; }
    if (!refund && type === 'Security Deposit' && b && max === 0) { form.setError('amount', { message: 'This booking has no security deposit left to receive. Edit the booking to set one.' }); return; }
    if (max != null && v.amount > max) { form.setError('amount', { message: `Cannot be more than ${formatPKR(max)}` }); return; }
    const proof = showProof ? await toBlob(form.getValues().paymentProof) : null;
    if (PROOF_REQUIRED.includes(methodEnum) && !proof) { toast.error('Please upload the payment screenshot for this payment method.'); return; }
    try { const p = await add({ bookingId: v.bookingId, type: v.type, amount: v.amount, method: v.method, paymentDate: v.date, notes: v.note, paymentProof: proof, requestId: reqId.current }).unwrap(); toast.success(refund ? 'Deposit refund saved successfully' : 'Payment saved successfully', { action: { label: 'Print Receipt', onClick: () => printHtml(receiptDoc(p, b), p.receiptNo) } }); onClose(); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <AppModal open={open} onClose={onClose} title={refund ? 'Refund Security Deposit' : 'Receive Payment'} subtitle="Choose how the money was paid, enter the amount and save."
      footer={<><button className="btn btn-neutral" onClick={onClose} disabled={isLoading}>Cancel</button><button className="btn btn-success" form="pay-form" type="submit" disabled={isLoading}><Save size={16} />{isLoading ? 'Saving…' : refund ? 'Save Refund' : 'Save Payment'}</button></>}>
      <Form id="pay-form" form={form} onSubmit={submit} className="space-y-4">
        <FormSelect name="bookingId" label="Booking" required options={options} placeholder={options.length ? 'Select booking' : 'No bookings with a balance'} disabled={!!bookingId} />
        {b && <div className="rounded-xl bg-soft border border-line p-3 grid grid-cols-3 gap-2 text-center text-sm"><div><p className="text-xs text-muted">Total Bill</p><b>{formatPKR(b.total)}</b></div><div><p className="text-xs text-muted">Received</p><b className="text-success">{formatPKR(b.paid)}</b></div><div><p className="text-xs text-muted">{refund ? 'Deposit Held' : 'Remaining'}</p><b className="text-danger">{formatPKR(refund ? b.depositHeld : b.balance)}</b></div></div>}
        <div className="grid sm:grid-cols-2 gap-3">
          {!refund && <FormSelect name="type" label="Payment For" required placeholder={null} options={[{ value: 'Partial', label: 'Rent - part payment' }, { value: 'Full', label: 'Rent - full balance' }, { value: 'Security Deposit', label: 'Security deposit (refundable)' }]} />}
          <MoneyInput name="amount" label={refund ? 'Amount Refunded' : 'Amount Received'} required />
          <FormDatePicker name="date" label="Date" required />
          {max > 0 && <div className="flex items-end"><button type="button" className="btn btn-outline btn-sm" onClick={() => form.setValue('amount', max, { shouldValidate: true })}>{refund ? 'Refund' : 'Receive'} full {formatPKR(max)}</button></div>}
        </div>
        <PaymentMethodPicker name="method" label={refund ? 'Paid Back By' : 'Payment Method'} />
        {showProof && <FormImageUpload name="paymentProof" label={`Payment Screenshot (${PROOF_REQUIRED.includes(methodEnum) ? 'required' : 'optional'})`} width="w-full" height="h-28" />}
        <FormInput name="note" label="Note (optional)" placeholder="e.g. JazzCash ref 123456" />
      </Form>
    </AppModal>
  );
}