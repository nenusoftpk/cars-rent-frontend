'use client';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import LoadingSkeleton from '@/components/common/LoadingSkeleton';
import NetworkError from '@/components/feedback/NetworkError';
import EmptyState from '@/components/common/EmptyState';
import NoResults from '@/components/common/NoResults';
import Pagination from './Pagination';
import PageSizeSelector from '@/components/filters/PageSizeSelector';

/**
 * Shared table used on every list page.
 * columns: [{ key, header, render?(row,i), sortable?, className?, align? }]
 * `data` is the server response: { items, total, page, pageSize, totalPages }
 */
export default function DataTable({ columns, data, isLoading, isFetching, error, onRetry, sort, onSort, onPage, onPageSize, hasFilters, onReset, emptyTitle, emptyMessage, emptyAction, footer, onRowClick, rowKey = 'id', noun, hidePager }) {
  const [sk, sd] = (sort || '').split(':');
  if (isLoading) return <LoadingSkeleton cols={Math.min(columns.length, 6)} />;
  if (error) return <NetworkError error={error} onRetry={onRetry} />;
  const rows = data?.items || [];
  if (!rows.length) return hasFilters ? <NoResults onReset={onReset} /> : <EmptyState title={emptyTitle || 'No records yet'} message={emptyMessage} action={emptyAction} />;
  return (
    <div className="relative">
      {isFetching && <div className="absolute inset-x-0 -top-1 h-0.5 bg-primary/20 overflow-hidden rounded"><div className="h-full w-1/3 bg-primary animate-pulse" /></div>}
      <div className={cn('overflow-x-auto', isFetching && 'opacity-80')}>
        <table className="table-clean min-w-[760px]">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sk === c.key; const Icon = !c.sortable ? null : active ? (sd === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th key={c.key} className={cn(c.align === 'right' && 'text-right', c.className)} aria-sort={active ? (sd === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortable && onSort ? (
                      <button type="button" className={cn('inline-flex items-center gap-1 hover:text-primary', active && 'text-primary')} onClick={() => onSort(`${c.key}:${active && sd === 'desc' ? 'asc' : 'desc'}`)}>{c.header}<Icon size={13} /></button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row[rowKey] ?? row.key ?? i} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn(onRowClick && 'cursor-pointer')}>
                {columns.map((c) => <td key={c.key} className={cn(c.align === 'right' && 'text-right', c.className)}>{c.render ? c.render(row, (data.page - 1) * data.pageSize + i + 1) : row[c.key] ?? '-'}</td>)}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {!hidePager && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[260px]"><Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={onPage} noun={noun} /></div>
          {onPageSize && <div className="pt-4"><PageSizeSelector value={data.pageSize} onChange={onPageSize} /></div>}
        </div>
      )}
    </div>
  );
}
