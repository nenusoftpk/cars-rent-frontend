import { cn } from '@/lib/utils';
// Content area that slightly overlaps the banner, like the reference screens.
export default function PageContainer({ children, className, overlap = true }) {
  return <div className={cn('px-4 sm:px-6 pb-10 space-y-4 relative z-[1]', overlap && '-mt-12 sm:-mt-14', className)}>{children}</div>;
}
