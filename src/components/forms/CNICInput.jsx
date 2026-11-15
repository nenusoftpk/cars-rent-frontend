'use client';
import { Field, Bound } from './Form';
import { cn } from '@/lib/utils';
export const fmtCnic = (s = '') => { const d = s.replace(/\D/g, '').slice(0, 13); if (d.length > 12) return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`; if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`; return d; };
export default function CNICInput({ name, value, onChange, label = 'CNIC Number', required, hint = 'Example: 35202-1234567-1', className, disabled }) {
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => (
        <Field label={label} required={required} error={error} hint={hint} className={className}>
          <input inputMode="numeric" disabled={disabled} value={v || ''} placeholder="35202-1234567-1" onChange={(e) => set(fmtCnic(e.target.value))} className={cn('input', error && 'input-error')} />
        </Field>
      )}
    </Bound>
  );
}
