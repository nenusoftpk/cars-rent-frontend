'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// value is a comma-separated string (easy to keep in the URL)
export default function MultiSelectFilter({ label, value = '', onChange, options = [], allLabel = 'All', className }) {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  const sel = value ? value.split(',') : [];
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const toggle = (v) => { const n = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]; onChange(n.join(',')); };
  return (
    <div className={cn('relative', className)} ref={ref}>
      {label && <label className="label">{label}</label>}
      <button type="button" className="input flex items-center justify-between text-left" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="truncate">{sel.length ? sel.join(', ') : allLabel}</span><ChevronDown size={16} className="text-muted shrink-0" />
      </button>
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-line bg-white shadow-pop p-1 anim-pop">
          {options.map((o) => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label;
            return <li key={v}><label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-soft cursor-pointer text-sm"><input type="checkbox" checked={sel.includes(v)} onChange={() => toggle(v)} className="accent-primary" />{l}</label></li>; })}
        </ul>
      )}
    </div>
  );
}
