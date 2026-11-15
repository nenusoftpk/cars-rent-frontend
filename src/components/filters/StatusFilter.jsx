import SelectFilter from './SelectFilter';
export default function StatusFilter({ options, allLabel = 'All Status', ...p }) { return <SelectFilter options={options} allLabel={allLabel} ariaLabel="Status" {...p} />; }
