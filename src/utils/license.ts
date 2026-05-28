// ============================================================
// LICENSE KEY UTILITIES — MSK Gestor
// Offline-capable: validation uses an embedded checksum,
// no server needed.
// ============================================================

// FNV-1a 32-bit — fast, no crypto dependency
// Secret is split to make simple string-search harder
const _K = ['ms', 'k2', '4l', 'ic', 'xk', '9q', '7j'].join('');

/** Charset — avoids visually confusable chars (0/O, 1/I) */
export const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function fnv32a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Derive 4-char checksum from 3 random segments */
function seg4(s1: string, s2: string, s3: string): string {
  let h = fnv32a(s1 + s2 + s3 + _K);
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += KEY_CHARS[h % KEY_CHARS.length];
    h = Math.floor(h / KEY_CHARS.length);
  }
  return out;
}

function randSeg(): string {
  return Array.from(
    { length: 4 },
    () => KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)],
  ).join('');
}

/** Generate a new MSK-XXXX-XXXX-XXXX-CCCC key */
export function generateLicenseKey(): string {
  const [s1, s2, s3] = [randSeg(), randSeg(), randSeg()];
  return `MSK-${s1}-${s2}-${s3}-${seg4(s1, s2, s3)}`;
}

/** Validate format + embedded checksum (fully offline) */
export function validateLicenseKey(key: string): boolean {
  if (!key) return false;
  const parts = key.trim().toUpperCase().split('-');
  if (parts.length !== 5 || parts[0] !== 'MSK') return false;
  if (parts.slice(1).some(p => !/^[A-Z0-9]{4}$/.test(p))) return false;
  return parts[4] === seg4(parts[1], parts[2], parts[3]);
}

/** Total size of all msk_* localStorage keys, in KB */
export function calcDbSizeKb(): number {
  let bytes = 0;
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('msk_')) {
      bytes += (localStorage.getItem(k)?.length ?? 0) * 2; // UTF-16
    }
  }
  return Math.round(bytes / 1024);
}

/** Format raw keyboard input into MSK-XXXX-XXXX-XXXX-XXXX while typing */
export function formatKeyInput(raw: string): string {
  // Strip anything that is not alphanumeric
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Prefix with MSK
  const body = clean.startsWith('MSK') ? clean.slice(3) : clean;
  // Reinsert dashes every 4 chars
  const segs = body.match(/.{1,4}/g) ?? [];
  return `MSK${segs.length ? '-' + segs.join('-') : ''}`.slice(0, 23); // MSK-XXXX-XXXX-XXXX-XXXX = 23 chars
}
