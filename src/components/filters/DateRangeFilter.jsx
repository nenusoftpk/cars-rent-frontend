'use client';
import { cn } from '@/lib/utils';
// Inclusive From / To dates (both days are included in the result).
export default function DateRangeFilter({ from = '', to = '', onChange, fromLabel = 'From Date', toLabel = 'To Date', className }) {
  return (
    <>
      <div className={cn('min-w-0', className)}><label className="label">{fromLabel}</label><input type="date" className="input" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value })} /></div>
      <div className={cn('min-w-0', className)}><label className="label">{toLabel}</label><input type="date" className="input" value={to} min={from || undefined} onChange={(e) => onChange({ to: e.target.value })} /></div>
    </>
  );
}
