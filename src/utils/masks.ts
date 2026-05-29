/**
 * Input mask utilities.
 * These format raw strings into display-ready masked values.
 */

/** CNJ process number: 0000000-00.0000.0.00.0000 */
export function maskCNJ(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 20);
  if (!digits) return raw;

  const p1 = digits.slice(0, 7);   // NNNNNNN
  const p2 = digits.slice(7, 9);   // DD
  const p3 = digits.slice(9, 13);  // AAAA
  const p4 = digits.slice(13, 14); // J
  const p5 = digits.slice(14, 16); // TT
  const p6 = digits.slice(16, 20); // OOOO

  let result = p1;
  if (p2) result += '-' + p2;
  if (p3) result += '.' + p3;
  if (p4) result += '.' + p4;
  if (p5) result += '.' + p5;
  if (p6) result += '.' + p6;

  return result;
}

/** Strips the CNJ mask, returning only digits */
export function stripCNJ(masked: string): string {
  return masked.replace(/\D/g, '');
}

/** Validates if a CNJ has exactly 20 digits */
export function isValidCNJ(value: string): boolean {
  return stripCNJ(value).length === 20;
}
