'use client';
import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Debounced search: waits 400ms after typing stops before changing the URL.
export default function SearchInput({ value = '', onChange, placeholder = 'Search…', delay = 400, className }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  useEffect(() => { const t = setTimeout(() => { if (v !== value) onChange(v); }, delay); return () => clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input className="input pl-9 pr-9" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {v && <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-heading" onClick={() => { setV(''); onChange(''); }}><X size={15} /></button>}
    </div>
  );
}
