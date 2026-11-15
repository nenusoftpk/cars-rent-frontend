import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function pages(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const s = new Set([1, total, page, page - 1, page + 1]); const arr = [...s].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return arr.flatMap((n, i) => (i && n - arr[i - 1] > 1 ? ['…', n] : [n]));
}
export default function Pagination({ page, totalPages, total, pageSize, onPage, noun = 'records' }) {
  const from = total ? (page - 1) * pageSize + 1 : 0; const to = Math.min(page * pageSize, total);
  const btn = 'grid place-items-center size-9 rounded-lg border text-sm font-semibold transition-colors';
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 pt-4" aria-label="Pagination">
      <p className="text-sm text-muted">Showing {from} to {to} of {total} {noun}</p>
      <div className="flex items-center gap-1.5">
        <button className={cn(btn, 'border-line bg-white hover:bg-soft disabled:opacity-40')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        {pages(page, totalPages).map((n, i) => n === '…' ? <span key={`d${i}`} className="px-1 text-muted">…</span> :
          <button key={n} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined} className={cn(btn, n === page ? 'bg-primary text-white border-primary' : 'border-line bg-white hover:bg-soft text-heading')}>{n}</button>)}
        <button className={cn(btn, 'border-line bg-white hover:bg-soft disabled:opacity-40')} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </nav>
  );
}
