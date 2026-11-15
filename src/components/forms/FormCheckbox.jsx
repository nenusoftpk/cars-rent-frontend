'use client';
import { useFormContext } from 'react-hook-form';
import { useFieldError } from './Form';
export default function FormCheckbox({ name, label, className, ...rest }) {
  const { register } = useFormContext(); const error = useFieldError(name);
  return (
    <div className={className}>
      <label className="inline-flex items-center gap-2 text-sm text-heading cursor-pointer"><input type="checkbox" className="size-4 accent-primary rounded" {...register(name)} {...rest} />{label}</label>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
