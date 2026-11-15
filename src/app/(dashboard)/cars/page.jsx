'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Car, CircleCheck, CarFront, Wrench, Plus, LayoutGrid, List, Eye, Pencil, CalendarPlus, Trash2, Fuel, Settings2, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage from '@/components/common/SmartImage';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';
import NetworkError from '@/components/feedback/NetworkError';
import EmptyState from '@/components/common/EmptyState';
import NoResults from '@/components/common/NoResults';
import Pagination from '@/components/tables/Pagination';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import StatusFilter from '@/components/filters/StatusFilter';
import SortDropdown from '@/components/filters/SortDropdown';
import PageSizeSelector from '@/components/filters/PageSizeSelector';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import ExportButtons from '@/components/tables/ExportButtons';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import CarFormModal from '@/features/cars/CarFormModal';
import CarDrawer from '@/features/cars/CarDrawer';
import { useGetCarsQuery, useGetCarStatsQuery, useDeleteCarMutation, carApi } from '@/redux/api/carApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useListParams } from '@/hooks/useListParams';
import { useExportAll } from '@/hooks/useExportAll';
import { useAuth } from '@/hooks/useAuth';
import { CAR_STATUSES, FUEL_TYPES, BRAND_MODELS } from '@/constants';
import { formatPKR } from '@/lib/money';

const DEFAULTS = { sort: 'name:asc', pageSize: 12, layout: 'grid' };
const SORTS = [{ value: 'name:asc', label: 'Name (A-Z)' }, { value: 'dailyRate:asc', label: 'Rent: low to high' }, { value: 'dailyRate:desc', label: 'Rent: high to low' }, { value: 'year:desc', label: 'Newest model' }];
const EXPORT_COLS = [{ header: 'Car', value: (r) => r.name }, { header: 'Number Plate', value: (r) => r.plate }, { header: 'Year', value: (r) => r.year }, { header: 'Fuel', value: (r) => r.fuel }, { header: 'Status', value: (r) => r.status }, { header: 'Rent / Day', value: (r) => formatPKR(r.dailyRate), right: true }];

export default function CarsPage() {
  const router = useRouter(); const { can } = useAuth();
  const { params, setParams, reset, hasFilters, apiParams } = useListParams(DEFAULTS);
  const { data, isLoading, isFetching, error, refetch } = useGetCarsQuery(apiParams);
  const { data: sm, isLoading: statsLoading } = useGetCarStatsQuery(); // list has no summary
  const exportAll = useExportAll(carApi.endpoints.getCars, apiParams);
  const [form, setForm] = useState(null); const [del, setDel] = useState(null); const [remove, { isLoading: deleting }] = useDeleteCarMutation();
  const viewId = params.view || null; const L = statsLoading; const grid = params.layout !== 'list';
  const confirmDelete = async () => { try { await remove(del.id).unwrap(); toast.success('Car deleted'); } catch (e) { toast.error(errorMessage(e)); } setDel(null); };
  const actions = (c) => [
    { label: 'View', icon: Eye, onClick: () => setParams({ view: c.id }, { keepPage: true }) }, { label: 'Edit', icon: Pencil, onClick: () => setForm(c), hidden: !can('cars:edit') },
    { label: 'Book This Car', icon: CalendarPlus, onClick: () => router.push(`/bookings/new?carId=${c.id}`), hidden: !can('bookings:create') || c.status === 'Under Repair' },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDel(c), hidden: !can('cars:delete') }];
  const columns = [
    { key: 'name', header: 'Car', sortable: true, render: (c) => <button className="flex items-center gap-3 text-left" onClick={() => setParams({ view: c.id }, { keepPage: true })}><SmartImage src={c.image} alt="" width={64} height={40} className="rounded-md bg-soft" /><span><b>{c.name}</b><span className="block text-xs text-muted">{c.year} · {c.color}</span></span></button> },
    { key: 'plate', header: 'Number Plate', render: (c) => <b className="tracking-wide">{c.plate}</b> },
    { key: 'specs', header: 'Details', render: (c) => <span className="text-xs text-muted">{c.transmission} · {c.fuel} · {c.seats} seats</span> },
    { key: 'dailyRate', header: 'Rent / Day', sortable: true, align: 'right', render: (c) => <b className="text-primary">{formatPKR(c.dailyRate)}</b> },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    { key: 'actions', header: 'Action', render: (c) => <TableActions actions={actions(c)} /> },
  ];
  return (
    <>
      <PageHeader title="Cars / Vehicle Management" subtitle="Manage your car fleet, pricing, documents and maintenance." actions={<PermissionGuard perm="cars.create"><button className="btn btn-primary" onClick={() => setForm({})}><Plus size={18} />Add Car</button></PermissionGuard>} />
      <PageContainer>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard loading={L} icon={Car} tone="blue" label="Total Cars" value={sm?.total} hint="All vehicles in system" href="/cars" />
          <StatCard loading={L} icon={CircleCheck} tone="green" label="Available" value={sm?.available} hint="Ready for booking" href="/cars?status=Available" />
          <StatCard loading={L} icon={CarFront} tone="orange" label="On Rent" value={sm ? sm.onRent + sm.booked : undefined} hint={sm ? `${sm.onRent} out · ${sm.booked} booked today` : ''} href="/cars?status=On+Rent" />
          <StatCard loading={L} icon={Wrench} tone="red" label="Under Repair" value={sm?.repair} hint="Not available" href="/cars?status=Under+Repair" />
        </div>
        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div><label className="label">Search</label><SearchInput value={params.search || ''} onChange={(v) => setParams({ search: v })} placeholder="Car name, model or number plate…" /></div>
          <StatusFilter label="Status" value={params.status || ''} onChange={(v) => setParams({ status: v })} options={CAR_STATUSES} />
          <SelectFilter label="Brand" value={params.brand || ''} onChange={(v) => setParams({ brand: v })} options={Object.keys(BRAND_MODELS)} allLabel="All Brands" />
          <SelectFilter label="Fuel" value={params.fuel || ''} onChange={(v) => setParams({ fuel: v })} options={FUEL_TYPES} allLabel="All Fuel Types" />
          <SortDropdown label="Sort" value={params.sort} onChange={(v) => setParams({ sort: v })} options={SORTS} />
        </FilterPanel>
        <SectionCard title="Cars" actions={<><div className="flex rounded-xl border border-line overflow-hidden" role="group" aria-label="Layout">
          <button className={`px-3 h-9 ${grid ? 'bg-primary text-white' : 'bg-white'}`} onClick={() => setParams({ layout: 'grid' }, { keepPage: true })} aria-label="Grid view" aria-pressed={grid}><LayoutGrid size={16} /></button>
          <button className={`px-3 h-9 ${!grid ? 'bg-primary text-white' : 'bg-white'}`} onClick={() => setParams({ layout: 'list' }, { keepPage: true })} aria-label="List view" aria-pressed={!grid}><List size={16} /></button></div>
          <ExportButtons module="cars" columns={EXPORT_COLS} loadRows={exportAll} title="Cars" filename="cars" /></>}>
          {!grid ? (
            <DataTable columns={columns} data={data} isLoading={isLoading} isFetching={isFetching} error={error} onRetry={refetch} sort={params.sort} onSort={(v) => setParams({ sort: v })} onPage={(p) => setParams({ page: p }, { keepPage: true })} onPageSize={(n) => setParams({ pageSize: n })} hasFilters={hasFilters} onReset={reset} noun="cars" emptyTitle="No cars yet" emptyMessage="Add your first car to start taking bookings." emptyAction={can('cars:create') && <button className="btn btn-primary" onClick={() => setForm({})}>Add Car</button>} />
          ) : isLoading ? <CardSkeleton /> : error ? <NetworkError error={error} onRetry={refetch} /> : !data?.items?.length ? (hasFilters ? <NoResults onReset={reset} /> : <EmptyState title="No cars yet" message="Add your first car to start taking bookings." />) : (
            <>
              <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 ${isFetching ? 'opacity-80' : ''}`}>
                {data.items.map((c) => (
                  <article key={c.id} className="rounded-2xl border border-line bg-white overflow-hidden hover:shadow-card transition">
                    <div className="relative bg-gradient-to-b from-soft to-white p-3"><span className="absolute left-3 top-3 z-10"><StatusBadge status={c.status} className="shadow-sm !bg-white" /></span>
                      <SmartImage src={c.image} alt={`${c.name} ${c.plate}`} width={300} height={160} className="w-full h-36 object-contain" /></div>
                    <div className="px-4 pb-4">
                      <p className="font-extrabold text-lg leading-tight">{c.plate}</p><p className="text-sm font-semibold">{c.name}</p><p className="text-xs text-muted">{c.year}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted mt-2"><span className="flex items-center gap-1"><Settings2 size={13} />{c.transmission}</span><span className="flex items-center gap-1"><Fuel size={13} />{c.fuel}</span><span className="flex items-center gap-1"><Users size={13} />{c.seats} Seats</span></div>
                      <p className="text-lg font-extrabold text-primary mt-2">{formatPKR(c.dailyRate)} <span className="text-xs font-medium text-muted">/ Day</span></p>
                      <div className="flex gap-2 mt-3"><button className="btn btn-primary btn-sm flex-1" onClick={() => setParams({ view: c.id }, { keepPage: true })}>View</button>{can('cars:edit') && <button className="btn btn-neutral btn-sm flex-1" onClick={() => setForm(c)}>Edit</button>}<TableActions actions={actions(c)} label={`More actions for ${c.name}`} /></div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex-1 min-w-[260px]"><Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={(p) => setParams({ page: p }, { keepPage: true })} noun="cars" /></div><div className="pt-4"><PageSizeSelector value={data.pageSize} onChange={(n) => setParams({ pageSize: n })} /></div></div>
            </>
          )}
        </SectionCard>
      </PageContainer>
      <CarFormModal open={!!form} car={form} onClose={() => setForm(null)} />
      <CarDrawer id={viewId} onClose={() => setParams({ view: '' }, { keepPage: true })} onEdit={(c) => { setParams({ view: '' }, { keepPage: true }); setForm(c); }} />
      <ConfirmDialog open={!!del} danger title="Delete car?" message={`“${del?.name} (${del?.plate})” will be deleted. This cannot be undone.`} confirmLabel="Delete Car" loading={deleting} onConfirm={confirmDelete} onCancel={() => setDel(null)} />
    </>
  );
}