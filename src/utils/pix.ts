/**
 * Gerador de PIX estático (BR Code / EMV Merchant-Presented QR Code)
 *
 * Especificação BCB: Resolução BCB nº 1 de 12/08/2020 — Anexo II
 * https://www.bcb.gov.br/content/estabilidadefinanceira/pix/
 *   Regulamento_Pix/II-Anexo-I-Padrões-para-Iniciação-do-Pix.pdf
 */

// ── CRC-16/CCITT-FALSE ────────────────────────────────────────
// Poly: 0x1021 | Init: 0xFFFF | RefIn: false | RefOut: false | XorOut: 0x0000
// IMPORTANTE: o & 0xffff dentro do loop é obrigatório para evitar overflow
// em JavaScript (inteiros de 32 bits com sinal).

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000
        ? ((crc << 1) ^ 0x1021) & 0xffff   // ← & 0xffff impede overflow
        : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// ── EMV TLV field ─────────────────────────────────────────────

function f(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

// ── Normalize strings for PIX (ISO 8859-1 safe) ──────────────

function clean(str: string, maxLen: number): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacritics
    .replace(/[^\x20-\x7E]/g, '')   // remove non-ASCII printable chars
    .trim()
    .slice(0, maxLen);
}

// ── PIX key normalization ─────────────────────────────────────

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

/**
 * Normalizes a PIX key to the format expected by the BCB.
 */
function normalizeKey(key: string, type?: PixKeyType): string {
  const k = key.trim();
  switch (type) {
    case 'cpf':
      return k.replace(/\D/g, ''); // 11 digits
    case 'cnpj':
      return k.replace(/\D/g, ''); // 14 digits
    case 'telefone': {
      // Must be +55XXXXXXXXXXX format
      const digits = k.replace(/\D/g, '');
      return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
    }
    case 'email':
      return k.toLowerCase();
    default:
      return k; // UUID / random key — use as-is
  }
}

// ── Public API ────────────────────────────────────────────────

export interface PixPayload {
  chave: string;
  chaveType?: PixKeyType;
  /** Merchant name, shown in the payer's bank app (max 25 chars) */
  nomeRecebedor: string;
  /** Merchant city (max 15 chars) */
  cidade?: string;
  /** Amount in BRL — omit to leave amount open */
  valor?: number;
  /**
   * Transaction description shown to the payer (max 72 chars).
   * Use simple ASCII text; special characters are stripped.
   */
  descricao?: string;
}

/**
 * Generates a valid BR Code (Pix Copia e Cola) payload.
 * Compatible with all Brazilian banks.
 *
 * @throws never — sanitizes inputs silently
 */
export function gerarPixBRCode(p: PixPayload): string {
  const chave   = normalizeKey(p.chave, p.chaveType);
  const nome    = clean(p.nomeRecebedor || 'Recebedor', 25) || 'Recebedor';
  const cidade  = clean(p.cidade || 'Brasil', 15) || 'Brasil';

  // ── Field 00: Format Indicator ────────────────────────────
  const f00 = f('00', '01');

  // ── Field 26: Merchant Account Information (PIX) ──────────
  // Sub-fields:
  //   00 = GUI (always "br.gov.bcb.pix")
  //   01 = PIX key
  //   02 = Additional info shown to payer (optional, ASCII only)
  const mai_gui = f('00', 'br.gov.bcb.pix');
  const mai_key = f('01', chave);
  const mai_inf = p.descricao
    ? f('02', clean(p.descricao, 72))
    : '';
  const f26 = f('26', mai_gui + mai_key + mai_inf);

  // ── Field 52: Merchant Category Code ─────────────────────
  const f52 = f('52', '0000');

  // ── Field 53: Transaction Currency (BRL = 986) ───────────
  const f53 = f('53', '986');

  // ── Field 54: Amount (optional) ──────────────────────────
  const f54 = p.valor != null ? f('54', p.valor.toFixed(2)) : '';

  // ── Field 58: Country Code ───────────────────────────────
  const f58 = f('58', 'BR');

  // ── Field 59: Merchant Name ──────────────────────────────
  const f59 = f('59', nome);

  // ── Field 60: Merchant City ──────────────────────────────
  const f60 = f('60', cidade);

  // ── Field 62: Additional Data Field Template ─────────────
  // Sub-field 05 = Transaction ID.
  // For static QR codes, BCB spec mandates "***" (three asterisks).
  const f62 = f('62', f('05', '***'));

  // ── Build payload (without CRC) ──────────────────────────
  const body = f00 + f26 + f52 + f53 + f54 + f58 + f59 + f60 + f62;

  // Append CRC sentinel "6304" before calculating checksum
  const withCrcId = body + '6304';

  return withCrcId + crc16(withCrcId);
}

/**
 * Returns the URL of a free QR code image via api.qrserver.com.
 * The image is ~200×200 px by default and requires an internet connection.
 */
export function pixQrCodeUrl(brCode: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(brCode)}&qzone=2&color=000000&bgcolor=ffffff&ecc=M`;
}
