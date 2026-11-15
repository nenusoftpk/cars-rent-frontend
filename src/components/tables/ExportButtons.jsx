'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Printer, FileText, FileSpreadsheet, FileDown } from 'lucide-react';
import { exportCSV, exportExcel, exportPDF } from '@/lib/export';
import { useAuth } from '@/hooks/useAuth';

// columns: [{ header, value:(row)=>text, right? }]   loadRows: async () => rows[] | { items }
export default function ExportButtons({ columns, loadRows, rows, title, subtitle, filename, totals, module, showCsv = false, size = 'btn-sm' }) {
  const [busy, setBusy] = useState('');
  const { can } = useAuth();
  const run = async (kind) => {
    setBusy(kind);
    try {
      const res = rows ? rows : await loadRows();
      const list = Array.isArray(res) ? res : res.items; const tot = typeof totals === 'function' ? totals(res) : totals;
      if (!list.length) { toast.info('No records found to export.'); return; }
      const f = filename || title.toLowerCase().replace(/\s+/g, '-');
      if (kind === 'print' || kind === 'pdf') exportPDF({ columns, rows: list, title, subtitle, totals: tot });
      if (kind === 'excel') exportExcel({ columns, rows: list, filename: f, title });
      if (kind === 'csv') exportCSV({ columns, rows: list, filename: f });
      if (kind === 'pdf') toast.message('In the print window, choose “Save as PDF”.');
    } catch (e) { toast.error(e?.data?.message || 'Could not prepare the file. Please try again.'); } finally { setBusy(''); }
  };
  const cls = `btn btn-outline ${size}`;
  const okPrint = !module || can(`${module}:print`); const okExport = !module || can(`${module}:export`);
  return (
    <div className="flex flex-wrap gap-2 no-print">
      {okPrint && <button className={cls} onClick={() => run('print')} disabled={!!busy}><Printer size={15} />{busy === 'print' ? 'Preparing…' : 'Print'}</button>}
      {okExport && <button className={cls} onClick={() => run('pdf')} disabled={!!busy}><FileText size={15} />Export PDF</button>}
      {okExport && <button className={cls} onClick={() => run('excel')} disabled={!!busy}><FileSpreadsheet size={15} />Export Excel</button>}
      {okExport && showCsv && <button className={cls} onClick={() => run('csv')} disabled={!!busy}><FileDown size={15} />CSV</button>}
    </div>
  );
}
