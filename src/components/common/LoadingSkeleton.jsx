export default function LoadingSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="space-y-3 p-2" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">{Array.from({ length: cols }).map((__, j) => <div key={j} className="skeleton h-8 flex-1" />)}</div>
      ))}
    </div>
  );
}
export const CardSkeleton = ({ count = 4 }) => (
  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton h-72" />)}</div>
);
