/**
 * Minimal RFC-4180 CSV parser.
 * Handles quoted fields, escaped quotes (""), CRLF and LF line endings.
 *
 * Returns an array of rows; each row is an array of string cells.
 * The first row is assumed to be the header.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  // Normalise line endings
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!input) return rows;

  let row: string[] = [];
  let cell = '';
  let inQuote = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuote) {
      if (ch === '"') {
        // Peek ahead — "" is an escaped quote inside a quoted field
        if (input[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuote = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (ch === '\n') {
        row.push(cell.trim());
        cell = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
    i++;
  }

  // Last cell / row
  row.push(cell.trim());
  if (row.some(c => c !== '')) rows.push(row);

  return rows;
}

/**
 * Converts a parsed CSV (rows[0] = headers) into an array of plain objects.
 */
export function csvToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const [headers, ...dataRows] = rows;
  return dataRows.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}
