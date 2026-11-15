import SelectFilter from './SelectFilter';
export default function SortDropdown({ value, onChange, options, label }) {
  return <SelectFilter label={label} value={value} onChange={onChange} options={options} allLabel={null} ariaLabel="Sort by" />;
}
