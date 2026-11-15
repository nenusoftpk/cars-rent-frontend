import Link from 'next/link';
import { ChevronRight, House } from 'lucide-react';

// The Lahore sunset banner. Identical on every page; only the text changes.
export default function PageBanner({ title, subtitle, breadcrumb = [], actions, right }) {
  return (
    <div className="page-banner relative text-white no-print">
      <div className="px-4 sm:px-6 pt-5 pb-16 sm:pb-20 min-h-[170px] flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          {breadcrumb.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-slate-200 mb-2">
              <Link href="/dashboard" className="flex items-center gap-1 hover:text-white"><House size={13} />Dashboard</Link>
              {breadcrumb.map((b) => <span key={b.label} className="flex items-center gap-1.5"><ChevronRight size={12} />{b.href ? <Link href={b.href} className="hover:text-white">{b.label}</Link> : <span className="text-white">{b.label}</span>}</span>)}
            </nav>
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm sm:text-[15px] text-slate-200 max-w-xl">{subtitle}</p>}
        </div>
        {(actions || right) && <div className="flex flex-wrap items-center gap-2 relative z-10">{right}{actions}</div>}
      </div>
    </div>
  );
}
