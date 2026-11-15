import { cn } from '@/lib/utils';
export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)} className={cn('tab', value === t.value && 'tab-active')}>
          {t.label}{t.count != null && <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[11px]', value === t.value ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-muted')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
