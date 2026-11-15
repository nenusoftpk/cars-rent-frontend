import { cn } from '@/lib/utils';
export default function SectionCard({ title, subtitle, actions, children, className, bodyClassName, number }) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5">
          <div className="flex items-center gap-3 min-w-0">
            {number != null && <span className="grid place-items-center size-8 rounded-lg bg-primary text-white font-bold shrink-0">{number}</span>}
            <div className="min-w-0"><h2 className="text-base sm:text-lg font-bold text-heading">{title}</h2>{subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}</div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
