'use client';
import { useFormContext } from 'react-hook-form';
import { Field, useFieldError } from './Form';
import { cn } from '@/lib/utils';

export default function FormSelect({ name, label, required, hint, options = [], placeholder = 'Select…', className, ...rest }) {
  const { register } = useFormContext(); const error = useFieldError(name);
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className} htmlFor={`f-${name}`}>
      <select id={`f-${name}`} aria-invalid={!!error} className={cn('input', error && 'input-error')} {...register(name)} {...rest}>
        {placeholder !== null && <option value="">{placeholder}</option>}
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}
