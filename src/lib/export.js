import { downloadUrl } from './files';
import { printHtml, tableDoc } from './printTemplates';

const esc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const rowsToMatrix = (columns, rows) => rows.map((r) => columns.map((c) => (typeof c.value === 'function' ? c.value(r) : r[c.key])));

export function exportCSV({ columns, rows, filename = 'export' }) {
  const lines = [columns.map((c) => cell(c.header)).join(','), ...rowsToMatrix(columns, rows).map((r) => r.map(cell).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); downloadUrl(url, `${filename}.csv`); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// Excel opens an HTML table saved as .xls - no extra library needed.
export function exportExcel({ columns, rows, filename = 'export', title = '' }) {
  const head = `<tr>${columns.map((c) => `<th style="background:#0866f5;color:#fff">${esc(c.header)}</th>`).join('')}</tr>`;
  const body = rowsToMatrix(columns, rows).map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('');
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>${title ? `<caption>${esc(title)}</caption>` : ''}${head}${body}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob); downloadUrl(url, `${filename}.xls`); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// Real, selectable-text PDF: opens the print dialog on a clean A4 table. Choose "Save as PDF".
export function exportPDF({ columns, rows, title = 'Report', subtitle = '', totals }) {
  printHtml(tableDoc({ title, subtitle, columns, rows, totals }), title);
}
export const printTable = exportPDF;
