'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Field, Bound } from './Form';
import { Avatar } from '@/components/common/SmartImage';
import { cn } from '@/lib/utils';

// Searchable dropdown base used by CustomerSelector / CarSelector (and any future selector).
export default function Combo({ name, value, onChange, label, required, hint, className, placeholder, options = [], onSearch, loading, selected, disabled, onPick, clearable = true, round = true }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  useEffect(() => { const t = setTimeout(() => onSearch?.(q), 300); return () => clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => (
        <Field label={label} required={required} error={error} hint={hint} className={className}>
          <div className="relative" ref={ref}>
            <button type="button" disabled={disabled} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} className={cn('input flex items-center gap-2 text-left', error && 'input-error')}>
              {v && selected ? <><Avatar src={selected.image} name={selected.label} size={24} className={round ? '' : '!rounded-md'} /><span className="truncate font-medium">{selected.label}</span>{selected.sub && <span className="text-xs text-muted truncate">{selected.sub}</span>}</> : <span className="text-slate-400 truncate">{placeholder}</span>}
              <span className="ml-auto flex items-center gap-1 shrink-0">
                {v && clearable && !disabled && <span role="button" tabIndex={0} aria-label="Clear" className="p-0.5 rounded hover:bg-soft" onClick={(e) => { e.stopPropagation(); set(''); onPick?.(null); }} onKeyDown={(e) => e.key === 'Enter' && (set(''), onPick?.(null))}><X size={14} /></span>}
                <ChevronDown size={16} className="text-muted" />
              </span>
            </button>
            {open && (
              <div className="absolute z-40 mt-1 w-full rounded-xl border border-line bg-white shadow-pop anim-pop">
                <div className="p-2 border-b border-line relative"><Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus className="input !h-9 pl-8" placeholder="Type to search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <ul role="listbox" className="max-h-60 overflow-auto p-1">
                  {loading && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
                  {!loading && !options.length && <li className="px-3 py-3 text-sm text-muted">No results found</li>}
                  {options.map((o) => (
                    <li key={o.value}><button type="button" role="option" aria-selected={o.value === v} disabled={o.disabled} onClick={() => { set(o.value); onPick?.(o.raw); setOpen(false); }} className={cn('w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-soft disabled:opacity-50', o.value === v && 'bg-primary/5')}>
                      <Avatar src={o.image} name={o.label} size={30} className={round ? '' : '!rounded-md'} /><span className="min-w-0"><span className="block text-sm font-medium truncate">{o.label}</span>{o.sub && <span className="block text-xs text-muted truncate">{o.sub}</span>}</span>{o.tag && <span className="ml-auto badge badge-warning">{o.tag}</span>}
                    </button></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Field>
      )}
    </Bound>
  );
}
