'use client';
import { useRef, useState } from 'react';
import { ImagePlus, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Field, Bound } from './Form';
import SmartImage from '@/components/common/SmartImage';
import { readUpload, IMAGE_TYPES } from '@/lib/files';
import { cn } from '@/lib/utils';

export default function FormImageUpload({ name, value, onChange, label, required, hint = 'JPG, PNG or WebP, up to 3 MB', locked, className, round, height = 'h-28', width = 'w-28' }) {
  const input = useRef(null); const [progress, setProgress] = useState(null);
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => {
        const pick = async (file) => {
          if (!file) return;
          try { setProgress(5); const r = await readUpload(file, { types: IMAGE_TYPES, onProgress: setProgress }); set(r.url); } catch (e) { toast.error(e.message); } finally { setTimeout(() => setProgress(null), 400); }
        };
        return (
          <Field label={label} required={required} error={error} hint={hint} className={className}>
            {locked ? (
              <div className={cn('grid place-items-center rounded-xl border border-dashed border-line bg-soft text-muted text-xs text-center p-2', height, width)}><span><Lock size={18} className="mx-auto mb-1" />Hidden</span></div>
            ) : (
              <button type="button" onClick={() => input.current?.click()} aria-label={`Upload ${label || 'image'}`}
                className={cn('relative overflow-hidden border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 grid place-items-center text-primary text-xs font-medium', round ? 'rounded-full' : 'rounded-xl', height, width, error && 'border-danger')}>
                {v ? <><SmartImage src={v} alt={label || ''} width={160} height={160} className="absolute inset-0 size-full object-cover" /><span className="absolute bottom-1 right-1 bg-white/90 rounded-full p-1"><RefreshCw size={12} /></span></> : <span className="flex flex-col items-center gap-1"><ImagePlus size={20} />Upload</span>}
                {progress != null && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/70"><span className="block h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></span>}
              </button>
            )}
            <input ref={input} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </Field>
        );
      }}
    </Bound>
  );
}
