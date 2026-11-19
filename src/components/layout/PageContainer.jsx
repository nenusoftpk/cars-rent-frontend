import { cn } from '@/lib/utils';

export default function PageContainer({
  children,
  className,
  overlap = true,
}) {
  return (
    <div
      className={cn(
        'relative z-[1] box-border w-full min-w-0 max-w-full',
        'space-y-4 px-4 pb-10 sm:px-6',
        overlap && '-mt-12 sm:-mt-14',
        className
      )}
    >
      {children}
    </div>
  );
}