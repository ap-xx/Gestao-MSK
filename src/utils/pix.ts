/**
 * Gerador de PIX estático (BR Code / EMV Merchant-Presented QR Code)
 *
 * Especificação: https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/
 *   - II-Anexo-I-Padrões-para-Iniciação-do-Pix.pdf
 *
 * Funciona com qualquer chave PIX (CPF, CNPJ, e-mail, telefone ou aleatória).
 * Não requer nenhuma API externa — o código gerado é válido em todos os bancos.
 */

// ── CRC-16/CCITT-FALSE ────────────────────────────────────────
// Polinômio: 0x1021, valor inicial: 0xFFFF, entrada/saída sem inversão.

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

// ── EMV field builder ─────────────────────────────────────────

function field(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

// ── Public API ────────────────────────────────────────────────

export interface PixPayload {
  /** Chave PIX do recebedor */
  chave: string;
  /** Nome do recebedor (máx 25 caracteres) */
  nomeRecebedor: string;
  /** Cidade do recebedor (máx 15 caracteres) */
  cidade?: string;
  /** Valor em reais — omitir para deixar em aberto */
  valor?: number;
  /** Descrição curta da cobrança (exibida no app do pagador) */
  descricao?: string;
  /** ID único da transação (txid), usado para conciliação — máx 25 chars */
  txid?: string;
}

/**
 * Gera o payload BR Code (Pix Copia e Cola) conforme padrão EMV do Banco Central.
 * O retorno é a string que deve ser codificada no QR Code.
 */
export function gerarPixBRCode(p: PixPayload): string {
  const chave      = p.chave.trim();
  const nome       = p.nomeRecebedor.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 25);
  const cidade     = (p.cidade ?? 'Brasil').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 15);
  const txid       = (p.txid ?? '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const descricao  = p.descricao ? p.descricao.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 72) : undefined;

  // 00 — Format Indicator
  const f00 = field('00', '01');

  // 26 — Merchant Account Information (PIX)
  const gui = field('00', 'br.gov.bcb.pix');
  const key = field('01', chave);
  const inf = descricao ? field('02', descricao) : '';
  const f26 = field('26', gui + key + inf);

  // 52 — Merchant Category Code
  const f52 = field('52', '0000');

  // 53 — Transaction Currency (BRL = 986)
  const f53 = field('53', '986');

  // 54 — Transaction Amount (optional)
  const f54 = p.valor != null ? field('54', p.valor.toFixed(2)) : '';

  // 58 — Country Code
  const f58 = field('58', 'BR');

  // 59 — Merchant Name
  const f59 = field('59', nome);

  // 60 — Merchant City
  const f60 = field('60', cidade);

  // 62 — Additional Data Field (txid inside)
  const f62 = field('62', field('05', txid));

  // Build payload without CRC
  const payload = f00 + f26 + f52 + f53 + f54 + f58 + f59 + f60 + f62 + '6304';

  return payload + crc16(payload);
}

/**
 * Returns a URL for a QR code image using the free qrserver.com API.
 * No API key required. Suitable for display; not for production PDFs.
 */
export function pixQrCodeUrl(brCode: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(brCode)}&qzone=1&color=000000&bgcolor=ffffff`;
}
