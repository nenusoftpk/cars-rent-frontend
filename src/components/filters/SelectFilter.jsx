'use client';
import { cn } from '@/lib/utils';
// options: ['A','B'] or [{value,label}]
export default function SelectFilter({ label, value = '', onChange, options = [], allLabel = 'All', className, ariaLabel }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div className={cn('min-w-0', className)}>
      {label && <label className="label">{label}</label>}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel || label || allLabel}>
        {allLabel !== null && <option value="">{allLabel}</option>}
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
