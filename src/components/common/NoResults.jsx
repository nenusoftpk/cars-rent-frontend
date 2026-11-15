import { SearchX } from 'lucide-react';
import EmptyState from './EmptyState';
export default function NoResults({ onReset, message = 'No records found for these filters or dates.' }) {
  return <EmptyState icon={SearchX} title="No results found" message={message} action={onReset && <button className="btn btn-outline" onClick={onReset}>Reset Filters</button>} />;
}
