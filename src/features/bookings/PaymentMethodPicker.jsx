'use client';
import { Bound } from '@/components/forms/Form';
import SmartImage from '@/components/common/SmartImage';
import { PAYMENT_METHODS, METHOD_ICON } from '@/constants';
import { cn } from '@/lib/utils';

const SHORT = { 'Other Online Transfer': 'Other Online' };
export default function PaymentMethodPicker({ name, value, onChange, label = 'Payment Method', compact }) {
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => (
        <div>
          {label && <p className="label">{label}</p>}
          <div role="radiogroup" aria-label={label} className={cn('grid gap-2', compact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-5')}>
            {PAYMENT_METHODS.map((m) => (
              <button type="button" key={m} role="radio" aria-checked={v === m} onClick={() => set(m)}
                className={cn('flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-[11px] sm:text-xs font-semibold transition', v === m ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20' : 'border-line bg-white hover:bg-soft text-heading')}>
                <SmartImage src={METHOD_ICON[m]} alt="" width={30} height={30} className="size-7 rounded-md" />{SHORT[m] || m}
              </button>
            ))}
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>
      )}
    </Bound>
  );
}
