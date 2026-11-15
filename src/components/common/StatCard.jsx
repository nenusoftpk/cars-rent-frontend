import Link from 'next/link';
import { cn } from '@/lib/utils';
const BG = { blue: 'bg-gradient-to-br from-indigo-500 to-blue-600', green: 'bg-gradient-to-br from-emerald-400 to-success', orange: 'bg-gradient-to-br from-amber-400 to-warning', red: 'bg-gradient-to-br from-rose-400 to-danger', purple: 'bg-gradient-to-br from-violet-500 to-purple-600', sky: 'bg-gradient-to-br from-sky-400 to-primary' };
export default function StatCard({ icon: Icon, label, value, hint, tone = 'blue', href, loading, className }) {
  const body = (
    <div className={cn('card flex items-center gap-3 p-4 h-full', href && 'hover:shadow-pop/20 hover:border-primary/40 transition', className)}>
      <span className={cn('stat-icon', BG[tone])}>{Icon && <Icon size={22} />}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-heading truncate">{label}</p>
        {loading ? <div className="skeleton h-7 w-16 my-1" /> : <p className="text-2xl font-extrabold leading-tight text-heading truncate">{value}</p>}
        {hint && <p className="text-xs text-muted truncate">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full focus-visible:rounded-2xl">{body}</Link> : body;
}
