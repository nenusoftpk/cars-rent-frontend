'use client';
import { useRef, useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Field, Bound } from './Form';
import { readUpload, DOC_TYPES, isImageUrl } from '@/lib/files';
import SmartImage from '@/components/common/SmartImage';

// Images or PDF, with progress bar and clear error messages. onFile(meta) gets {name, mime, size, url}.
export default function FormFileUpload({ name, value, onChange, label, required, hint = 'JPG, PNG, WebP or PDF, up to 3 MB', onFile, className }) {
  const input = useRef(null); const [progress, setProgress] = useState(null); const [err, setErr] = useState('');
  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v, onChange: set, error }) => {
        const pick = async (file) => {
          if (!file) return; setErr('');
          try { setProgress(3); const r = await readUpload(file, { types: DOC_TYPES, onProgress: setProgress }); set(r.url); onFile?.(r); toast.success('File uploaded'); }
          catch (e) { setErr(e.message); toast.error(e.message); } finally { setTimeout(() => setProgress(null), 500); }
        };
        return (
          <Field label={label} required={required} error={error || err} hint={hint} className={className}>
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
              className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 flex items-center gap-4">
              <div className="size-16 rounded-lg bg-white border border-line grid place-items-center overflow-hidden shrink-0">
                {v ? (isImageUrl(v) ? <SmartImage src={v} alt="Preview" width={64} height={64} className="size-full object-cover" /> : <FileText className="text-primary" />) : <UploadCloud className="text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()}>{v ? 'Replace file' : 'Choose file'}</button>
                <p className="text-xs text-muted mt-1.5">or drag and drop here</p>
                {progress != null && <div className="mt-2 h-1.5 rounded bg-white overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
              </div>
            </div>
            <input ref={input} type="file" accept={DOC_TYPES.join(',')} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </Field>
        );
      }}
    </Bound>
  );
}
