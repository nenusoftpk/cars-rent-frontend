import { PAGE_SIZES } from '@/constants';
export default function PageSizeSelector({ value = 10, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="sr-only sm:not-sr-only">Show</span>
      <select className="input !h-9 !w-auto" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Rows per page">
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
      </select>
    </label>
  );
}
