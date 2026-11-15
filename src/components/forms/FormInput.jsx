'use client';
import { useFormContext } from 'react-hook-form';
import { Field, useFieldError } from './Form';
import { cn } from '@/lib/utils';

export default function FormInput({ name, label, required, hint, as = 'input', type = 'text', className, inputClassName, rows = 3, ...rest }) {
  const { register } = useFormContext(); const error = useFieldError(name); const id = `f-${name}`;
  const Tag = as;
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className} htmlFor={id}>
      <Tag id={id} type={as === 'input' ? type : undefined} rows={as === 'textarea' ? rows : undefined} aria-invalid={!!error} className={cn('input', error && 'input-error', inputClassName)} {...register(name)} {...rest} />
    </Field>
  );
}
