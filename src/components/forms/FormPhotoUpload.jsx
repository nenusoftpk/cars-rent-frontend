'use client';
import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { Field, Bound } from './Form';
import SmartImage from '@/components/common/SmartImage';
import { readUpload, IMAGE_TYPES } from '@/lib/files';

// Several photos (car condition). value = array of image URLs.
export default function FormPhotoUpload({ name, value, onChange, label, hint = 'Add up to 8 photos: front, back, sides, inside and meter', max = 8, className }) {
  const input = useRef(null); const [busy, setBusy] = useState(false);
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => {
        const list = v || [];
        const add = async (files) => {
          const room = max - list.length; if (room <= 0) { toast.error(`You can add up to ${max} photos.`); return; }
          setBusy(true); const out = [];
          for (const f of [...files].slice(0, room)) { try { out.push((await readUpload(f, { types: IMAGE_TYPES })).url); } catch (e) { toast.error(`${f.name}: ${e.message}`); } }
          set([...list, ...out]); setBusy(false);
        };
        return (
          <Field label={label} error={error} hint={hint} className={className}>
            <div className="flex flex-wrap gap-2">
              {list.map((u, i) => <div key={i} className="relative size-20 rounded-lg overflow-hidden border border-line"><SmartImage src={u} alt={`Photo ${i + 1}`} width={80} height={80} className="size-full object-cover" /><button type="button" aria-label="Remove photo" onClick={() => set(list.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 grid place-items-center size-5 rounded-full bg-black/60 text-white"><X size={12} /></button></div>)}
              {list.length < max && <button type="button" onClick={() => input.current?.click()} disabled={busy} className="size-20 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-primary text-xs grid place-items-center hover:bg-primary/10"><span className="flex flex-col items-center gap-1"><Camera size={18} />{busy ? 'Adding…' : 'Add'}</span></button>}
            </div>
            <input ref={input} type="file" multiple accept={IMAGE_TYPES.join(',')} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </Field>
        );
      }}
    </Bound>
  );
}
