'use client';
import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

// The "..." menu on every table row. actions: [{label, icon, onClick, danger, hidden}]
export default function TableActions({ actions = [], label = 'Row actions' }) {
  const [pos, setPos] = useState(null); const btn = useRef(null);
  const list = actions.filter((a) => !a.hidden);
  useEffect(() => {
    if (!pos) return undefined; const close = () => setPos(null);
    const k = (e) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close); document.addEventListener('keydown', k);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', k); };
  }, [pos]);
  if (!list.length) return null;
  const open = () => { const r = btn.current.getBoundingClientRect(); const h = list.length * 38 + 12; setPos({ top: r.bottom + h > window.innerHeight ? r.top - h : r.bottom + 4, left: Math.max(8, r.right - 190) }); };
  return (
    <>
      <button ref={btn} type="button" className="btn btn-neutral btn-sm !px-2" aria-label={label} aria-haspopup="menu" onClick={(e) => { e.stopPropagation(); pos ? setPos(null) : open(); }}><MoreHorizontal size={16} /></button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} />
          <ul role="menu" className="fixed z-50 w-[190px] rounded-xl border border-line bg-white shadow-pop p-1 anim-pop" style={{ top: pos.top, left: pos.left }}>
            {list.map((a) => (
              <li key={a.label}><button role="menuitem" className={cn('w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left hover:bg-soft', a.danger ? 'text-danger' : 'text-heading')} onClick={(e) => { e.stopPropagation(); setPos(null); a.onClick(); }}>{a.icon && <a.icon size={15} />}{a.label}</button></li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
