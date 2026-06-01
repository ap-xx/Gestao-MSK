import * as XLSX from 'xlsx';

/**
 * Generates and downloads a formatted .xlsx workbook.
 *
 * @param filename  File name (without extension)
 * @param sheets    Array of sheet definitions; each sheet has a name, headers and rows
 */
export function downloadXlsx(
  filename: string,
  sheets: Array<{
    name: string;
    headers: string[];
    rows: (string | number | null | undefined)[][];
  }>,
) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    // Build array-of-arrays: first row = headers
    const aoa: (string | number | null | undefined)[][] = [
      sheet.headers,
      ...sheet.rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Style header row (bold background) — xlsx-js supports limited styling
    // via cell properties; we set column widths for readability
    const colWidths = sheet.headers.map((h, colIdx) => {
      const maxLen = Math.max(
        h.length,
        ...sheet.rows.map(r => String(r[colIdx] ?? '').length),
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
    });
    ws['!cols'] = colWidths;

    // Freeze top row (headers)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Formats a date string (YYYY-MM-DD or ISO) for Excel cells. */
export function xlsxDate(s: string | undefined | null): string {
  if (!s) return '';
  return new Date(s.length > 10 ? s : s + 'T12:00:00').toLocaleDateString('pt-BR');
}

/** Formats a number as currency string. */
export function xlsxCurrency(v: number | undefined | null): string {
  if (v == null) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
