'use client';
import { Field, Bound } from './Form';
import { cn } from '@/lib/utils';
export const fmtPhone = (s = '') => { const d = s.replace(/\D/g, '').slice(0, 11); return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d; };
export default function PhoneInput({ name, value, onChange, label = 'Mobile Number', required, hint = 'Example: 0300-1234567', className, disabled }) {
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => (
        <Field label={label} required={required} error={error} hint={hint} className={className}>
          <input type="tel" inputMode="numeric" autoComplete="tel" disabled={disabled} value={v || ''} placeholder="0300-1234567" onChange={(e) => set(fmtPhone(e.target.value))} className={cn('input', error && 'input-error')} />
        </Field>
      )}
    </Bound>
  );
}
