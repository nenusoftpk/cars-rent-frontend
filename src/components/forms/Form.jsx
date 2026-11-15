'use client';
import { FormProvider, useFormContext, Controller } from 'react-hook-form';
import { get, cn } from '@/lib/utils';

export default function Form({ form, onSubmit, children, className, id }) {
  return <FormProvider {...form}><form id={id} noValidate onSubmit={form.handleSubmit(onSubmit)} className={className}>{children}</form></FormProvider>;
}

export function Field({ label, required, error, hint, children, className, htmlFor }) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && <label htmlFor={htmlFor} className="label">{label}{required && <span className="text-danger"> *</span>}</label>}
      {children}
      {hint && !error && <p className="text-xs text-muted mt-1">{hint}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
export const useFieldError = (name) => { const { formState: { errors } } = useFormContext(); return get(errors, name)?.message; };

// Works inside a form (name) or standalone (value / onChange).
export function Bound({ name, value, onChange, children }) {
  const ctx = useFormContext();
  if (name && ctx) return <Controller name={name} control={ctx.control} render={({ field, fieldState }) => children({ value: field.value, onChange: field.onChange, error: fieldState.error?.message })} />;
  return children({ value, onChange, error: null });
}
