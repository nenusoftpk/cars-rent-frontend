'use client';
import { Field, Bound } from './Form';
import { cn } from '@/lib/utils';
export const fmtPlate = (s = '') => {
  const c = s.toUpperCase().replace(/[^A-Z0-9]/g, ''); const letters = (c.match(/^[A-Z]*/)?.[0] || '').slice(0, 3); const digits = c.slice((c.match(/^[A-Z]*/)?.[0] || '').length).replace(/\D/g, '').slice(0, 4);
  return digits || s.endsWith('-') ? `${letters}-${digits}` : letters;
};
export default function NumberPlateInput({ name, value, onChange, label = 'Number Plate', required, hint = 'Example: LHR-1234', className }) {
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => (
        <Field label={label} required={required} error={error} hint={hint} className={className}>
          <input value={v || ''} placeholder="LHR-1234" onChange={(e) => set(fmtPlate(e.target.value))} className={cn('input uppercase tracking-wider font-semibold', error && 'input-error')} />
        </Field>
      )}
    </Bound>
  );
}
