'use client';
import { useFormContext } from 'react-hook-form';
import { Field, useFieldError } from './Form';
import { cn } from '@/lib/utils';
export default function FormRadioGroup({ name, label, required, options = [], className, inline = true }) {
  const { register, watch } = useFormContext(); const error = useFieldError(name); const cur = watch(name);
  return (
    <Field label={label} required={required} error={error} className={className}>
      <div className={cn('flex gap-2', inline ? 'flex-wrap' : 'flex-col')} role="radiogroup">
        {options.map((o) => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label;
          return <label key={v} className={cn('flex items-center gap-2 rounded-xl border px-3 h-10 text-sm cursor-pointer', cur === v ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-line bg-white')}><input type="radio" value={v} className="accent-primary" {...register(name)} />{l}</label>; })}
      </div>
    </Field>
  );
}
