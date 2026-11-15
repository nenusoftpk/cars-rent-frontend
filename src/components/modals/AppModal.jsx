'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
export default function AppModal({ open, onClose, title, subtitle, children, footer, size = 'md', dismissible = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement; document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && dismissible) onClose?.(); };
    document.addEventListener('keydown', onKey); setTimeout(() => ref.current?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose, dismissible]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-3 sm:p-6 anim-fade" role="presentation">
      <div className="absolute inset-0 bg-sidebar/60 backdrop-blur-[2px]" onClick={() => dismissible && onClose?.()} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cn('relative w-full bg-white rounded-2xl shadow-pop max-h-[92vh] flex flex-col anim-pop outline-none', SIZES[size])}>
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
          <div><h2 className="text-lg font-bold text-heading">{title}</h2>{subtitle && <p className="text-sm text-muted">{subtitle}</p>}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm !px-2" aria-label="Close"><X size={18} /></button>
        </header>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-line flex flex-wrap justify-end gap-2 bg-soft rounded-b-2xl">{footer}</footer>}
      </div>
    </div>, document.body);
}
