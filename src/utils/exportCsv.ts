/**
 * Downloads data as a UTF-8 CSV file (with BOM so Excel opens it correctly).
 *
 * @param filename - File name including .csv extension
 * @param headers  - Column header labels
 * @param rows     - Data rows (each cell will be auto-quoted)
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;

  const content = [headers, ...rows]
    .map(row => row.map(escape).join(','))
    .join('\r\n');

  // BOM (﻿) makes Excel/LibreOffice interpret the file as UTF-8
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Formats a date string (YYYY-MM-DD) to DD/MM/YYYY for display in CSV. */
export function fmtCsvDate(s: string | undefined | null): string {
  if (!s) return '';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

/** Formats a number as Brazilian currency string (R$ 1.234,56). */
export function fmtCsvCurrency(v: number | undefined | null): string {
  if (v == null) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
