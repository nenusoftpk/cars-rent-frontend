import { cn } from '@/lib/utils';

export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  number,
}) {
  return (
    <section
      className={cn(
        'card box-border w-full min-w-0 max-w-full',
        className
      )}
    >
      {(title || actions) && (
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex min-w-0 items-center gap-3">
            {number != null && (
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-bold text-white">
                {number}
              </span>
            )}

            <div className="min-w-0">
              <h2 className="text-base font-bold text-heading sm:text-lg">
                {title}
              </h2>

              {subtitle && (
                <p className="mt-0.5 text-xs text-muted">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </header>
      )}

      <div
        className={cn(
          'box-border w-full min-w-0 max-w-full p-4 sm:p-5',
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}