/**
 * /api/boleto — Geração de boletos bancários
 *
 * Bradesco: OAuth2 client_credentials (sem mTLS no developer portal público)
 *   Pré-requisitos no Render:
 *     BRADESCO_CLIENT_ID      → developers.bradesco.com.br → sua aplicação
 *     BRADESCO_CLIENT_SECRET  → idem
 *     BRADESCO_MERCHANT_ID    → Merchant ID fornecido pelo Bradesco ao seu cadastro
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// ── Token cache (in-memory; reseta ao reiniciar o servidor) ───
interface TokenCache { access_token: string; expires_at: number; }
let bradescoCache: TokenCache | null = null;

async function getBradescoToken(): Promise<string> {
  if (bradescoCache && Date.now() < bradescoCache.expires_at) {
    return bradescoCache.access_token;
  }

  const CLIENT_ID     = process.env.BRADESCO_CLIENT_ID;
  const CLIENT_SECRET = process.env.BRADESCO_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      'BRADESCO_CLIENT_ID e BRADESCO_CLIENT_SECRET precisam estar configurados nas variáveis de ambiente do Render.',
    );
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const r = await fetch('https://proxy.api.prebanco.com.br/auth/server/v1.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      data.error_description || data.error || `Autenticação Bradesco falhou: HTTP ${r.status}`,
    );
  }

  bradescoCache = {
    access_token: data.access_token,
    // Renova 60 s antes de expirar para evitar race conditions
    expires_at: Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000,
  };
  return data.access_token;
}

// ── Formatadores ───────────────────────────────────────────────

/** Valor monetário → 12 dígitos em centavos ("000000001000" = R$ 10,00) */
function fmtValor(v: number): string {
  return Math.round(v * 100).toString().padStart(12, '0');
}

/** ISO "AAAA-MM-DD" → "DD/MM/AAAA" */
function fmtData(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Data/hora atual → "DD/MM/AAAA HH:MM:SS" */
function fmtNow(): string {
  const n = new Date();
  const p = (v: number) => String(v).padStart(2, '0');
  return `${p(n.getDate())}/${p(n.getMonth() + 1)}/${n.getFullYear()} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
}

/** Normaliza o status Bradesco para o nosso enum interno */
function normalizeStatus(raw: string): string {
  const s = String(raw).toUpperCase();
  if (['06', '6', 'LIQUIDADO', 'PAGO', 'RECEBIDO'].some(x => s.includes(x))) return 'RECEIVED';
  if (['02', '2', 'VENCIDO', 'OVERDUE'].some(x => s.includes(x)))            return 'OVERDUE';
  if (['09', '9', 'CANCELADO', 'BAIXADO'].some(x => s.includes(x)))          return 'CANCELLED';
  return 'PENDING';
}

// ═════════════════════════════════════════════════════════════
// POST /api/boleto/bradesco/criar
// Body: { nomeComprador, cpfCnpj, emailComprador?, valor, dataVencimento, descricao? }
// ═════════════════════════════════════════════════════════════
router.post('/bradesco/criar', async (req: Request, res: Response) => {
  const {
    nomeComprador, cpfCnpj, emailComprador,
    valor, dataVencimento, descricao,
  } = req.body as {
    nomeComprador: string;
    cpfCnpj: string;
    emailComprador?: string;
    valor: number;
    dataVencimento: string;
    descricao?: string;
  };

  if (!nomeComprador || !cpfCnpj || !valor || !dataVencimento) {
    res.status(400).json({
      error: 'Campos obrigatórios: nomeComprador, cpfCnpj, valor, dataVencimento',
    });
    return;
  }

  const MERCHANT_ID = process.env.BRADESCO_MERCHANT_ID;
  if (!MERCHANT_ID) {
    res.status(503).json({
      error: 'BRADESCO_MERCHANT_ID não configurado. Adicione nas variáveis de ambiente do Render.',
    });
    return;
  }

  try {
    const token        = await getBradescoToken();
    const numeroPedido = `MSK-${Date.now()}`;
    const desc         = descricao || 'Honorários Advocatícios';
    const valorFmt     = fmtValor(Number(valor));

    const payload = {
      merchant_id:        MERCHANT_ID,
      meio_pagamento:     '300',          // 300 = boleto bancário
      numero_pedido:      numeroPedido,
      data_transacao:     fmtNow(),
      valor_transacao:    valorFmt,
      data_vencimento:    fmtData(dataVencimento),
      instrucao1:         desc,
      url_retorno:        process.env.FRONTEND_URL ?? 'https://mskgestor.vercel.app',
      nome_comprador:     nomeComprador,
      cpf_cnpj_comprador: cpfCnpj.replace(/\D/g, ''),
      ...(emailComprador ? { email_comprador: emailComprador } : {}),
      tipo_detalhe:       'produto',
      descricao_detalhe:  desc,
      valor_detalhe:      valorFmt,
    };

    const r = await fetch('https://proxy.api.prebanco.com.br/v1/boleto-cobranca/registros', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await r.json().catch(() => ({}));

    if (!r.ok) {
      res.status(r.status).json({
        error:  data.message || data.erro || data.msgRetorno || `Erro Bradesco: HTTP ${r.status}`,
        detail: data,
      });
      return;
    }

    // Normaliza campos — Bradesco pode variar entre versões da API
    res.json({
      numeroPedido,
      nossoNumero:    data.nossoNumero    ?? data.nosso_numero    ?? data.number_token    ?? '',
      codigoBarras:   data.codigo_barras  ?? data.codigoBarras    ?? '',
      linhaDigitavel: data.linhaDigitavel ?? data.linha_digitavel ?? '',
      linkBoleto:     data.link_boleto    ?? data.linkBoleto      ?? data.url_boleto      ?? '',
      linkPix:        data.link_qrcode_pix ?? '',
      qrCodePix:      data.qrcode_pix      ?? '',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[boleto:bradesco:criar]', msg);
    res.status(500).json({ error: msg });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/boleto/bradesco/status/:numeroPedido
// ═════════════════════════════════════════════════════════════
router.get('/bradesco/status/:numeroPedido', async (req: Request, res: Response) => {
  const MERCHANT_ID = process.env.BRADESCO_MERCHANT_ID;
  if (!MERCHANT_ID) {
    res.status(503).json({ error: 'BRADESCO_MERCHANT_ID não configurado' });
    return;
  }

  try {
    const token = await getBradescoToken();
    const r = await fetch(
      `https://proxy.api.prebanco.com.br/v1/boleto-cobranca/consultas?merchant_id=${MERCHANT_ID}&numero_pedido=${encodeURIComponent(req.params.numeroPedido)}`,
      { headers: { 'Authorization': `Bearer ${token}` } },
    );

    const data: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(r.status).json({ error: data.message || `Erro ${r.status}` });
      return;
    }

    const rawStatus = data.status ?? data.cod_status ?? data.codStatus ?? '';
    res.json({ status: normalizeStatus(String(rawStatus)), raw: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ═════════════════════════════════════════════════════════════
// GET /api/boleto/bradesco/config-status — verifica se vars estão presentes (sem expor valores)
// ═════════════════════════════════════════════════════════════
router.get('/bradesco/config-status', (_req, res) => {
  res.json({
    configured: !!(
      process.env.BRADESCO_CLIENT_ID &&
      process.env.BRADESCO_CLIENT_SECRET &&
      process.env.BRADESCO_MERCHANT_ID
    ),
  });
});

export default router;
