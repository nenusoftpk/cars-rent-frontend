'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DetailDrawer({ open, onClose, title, children, footer, width = 'max-w-xl', headerRight }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement; const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'; setTimeout(() => ref.current?.focus(), 30);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] anim-fade">
      <div className="absolute inset-0 bg-sidebar/50" onClick={onClose} />
      <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={cn('absolute right-0 top-0 h-full w-full bg-white shadow-pop flex flex-col anim-drawer outline-none', width)}>
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="text-lg font-bold text-heading truncate">{title}</h2>
          <div className="flex items-center gap-2">{headerRight}<button onClick={onClose} className="btn btn-ghost btn-sm !px-2" aria-label="Close"><X size={18} /></button></div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-line bg-soft flex flex-wrap gap-2">{footer}</footer>}
      </aside>
    </div>, document.body);
}
