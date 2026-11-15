import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
export default function FilterPanel({ children, onReset, className, cols = 'sm:grid-cols-2 lg:grid-cols-4', extra }) {
  return (
    <div className={cn('card p-4 sm:p-5', className)}>
      <div className={cn('grid grid-cols-1 gap-3 items-end', cols)}>
        {children}
        {(onReset || extra) && <div className="flex gap-2 items-end">{extra}{onReset && <button type="button" className="btn btn-outline flex-1 sm:flex-none" onClick={onReset}><RotateCcw size={16} />Reset</button>}</div>}
      </div>
    </div>
  );
}
