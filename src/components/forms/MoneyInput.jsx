'use client';
import { Field, Bound } from './Form';
import { cn } from '@/lib/utils';

export default function MoneyInput({ name, value, onChange, label, required, hint, className, placeholder = '0', disabled, suffix, compact }) {
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => {
        const shown = v === '' || v == null || Number(v) === 0 && v !== 0 ? (v === 0 ? '0' : '') : Number(v).toLocaleString('en-US');
        return (
          <Field label={label} required={required} error={error} hint={hint} className={className}>
            <div className="relative">
              {!compact && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">Rs.</span>}
              <input inputMode="numeric" disabled={disabled} aria-label={label || 'Amount'} placeholder={placeholder} value={shown}
                onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ''); set(d === '' ? '' : Number(d)); }}
                className={cn('input', !compact && 'pl-10', suffix && 'pr-14', error && 'input-error')} />
              {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
            </div>
          </Field>
        );
      }}
    </Bound>
  );
}
