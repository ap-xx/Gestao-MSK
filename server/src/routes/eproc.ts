/**
 * e-Proc integration — login with username/password and query process data.
 *
 * Supported systems (TRF4's e-Proc V2 family):
 *   TJSC, TJPR, TJRS, TRF4, TRF1 etc.
 *
 * POST /api/eproc/config         — save/update credentials (admin)
 * GET  /api/eproc/config         — list configured tribunals (admin)
 * DELETE /api/eproc/config/:t    — remove credentials (admin)
 * POST /api/eproc/consultar      — query a process (any authenticated user)
 */

import { Router, Request, Response } from 'express';
import { parse as parseHtml } from 'node-html-parser';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { encrypt, decrypt } from '../crypto';

const router = Router();

// ── Known e-Proc tribunal URLs ────────────────────────────────
export const EPROC_TRIBUNAIS: Record<string, { nome: string; url: string }> = {
  tjsc:  { nome: 'TJ Santa Catarina',    url: 'https://eproc.tjsc.jus.br/eprocV2'  },
  tjpr:  { nome: 'TJ Paraná',            url: 'https://eproc.tjpr.jus.br/eprocV2'  },
  tjrs:  { nome: 'TJ Rio Grande do Sul', url: 'https://eproc.tjrs.jus.br/eprocV2'  },
  trf4:  { nome: 'TRF 4ª Região',        url: 'https://eproc.trf4.jus.br/eprocV2'  },
  trf1:  { nome: 'TRF 1ª Região',        url: 'https://eproc.trf1.jus.br/eprocV2'  },
};

// ── Helpers ───────────────────────────────────────────────────

function parseCookies(headers: Headers, existing = ''): string {
  const raw = headers.getSetCookie?.() ?? [];
  const map: Record<string, string> = {};
  // parse existing
  for (const part of existing.split(';').map(s => s.trim()).filter(Boolean)) {
    const [k, v] = part.split('=');
    if (k) map[k.trim()] = v ?? '';
  }
  // parse new
  for (const cookie of raw) {
    const part = cookie.split(';')[0];
    const [k, v] = part.split('=');
    if (k) map[k.trim()] = v ?? '';
  }
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ');
}

/** Login to an e-Proc instance and return the session cookie. */
async function eprocLogin(
  baseUrl: string,
  usuario: string,
  senha: string,
): Promise<string> {
  const loginUrl = `${baseUrl}/controlador.php`;

  // Step 1: GET the login page to harvest any hidden fields / initial cookies
  const loginPage = await fetch(loginUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MSK-Gestor/1.0)' },
    // @ts-ignore
    signal: AbortSignal.timeout(15_000),
  });
  let cookie = parseCookies(loginPage.headers as any);

  // Step 2: POST credentials
  const body = new URLSearchParams({
    acao:         'entrar',
    txtEntrada:   usuario,
    pwdEntrada:   senha,
    chkLembrar:   'on',
  });

  const loginRes = await fetch(loginUrl, {
    method:   'POST',
    headers:  {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie':        cookie,
      'User-Agent':   'Mozilla/5.0 (compatible; MSK-Gestor/1.0)',
      'Referer':       loginUrl,
    },
    body:     body.toString(),
    redirect: 'manual', // don't follow redirects automatically
    // @ts-ignore
    signal: AbortSignal.timeout(15_000),
  });

  cookie = parseCookies(loginRes.headers as any, cookie);

  // Detect failed login (page stays at login or shows error)
  const html = await loginRes.text().catch(() => '');
  if (html.includes('Senha incorreta') || html.includes('Usuário não encontrado') ||
      html.includes('Acesso negado') || html.includes('txtEntrada')) {
    throw new Error('Credenciais inválidas. Verifique o login e senha do e-Proc.');
  }

  if (!cookie) throw new Error('Não foi possível obter sessão do e-Proc.');
  return cookie;
}

/** Query a process page using an existing session cookie. */
async function eprocQueryProcess(
  baseUrl: string,
  cookie: string,
  numeroCNJ: string,
): Promise<Record<string, string>> {
  const digits  = numeroCNJ.replace(/\D/g, '');
  const url     = `${baseUrl}/controlador.php?acao=processo_seleciona_publica&num_processo=${digits}`;

  const res  = await fetch(url, {
    headers: {
      'Cookie':     cookie,
      'User-Agent': 'Mozilla/5.0 (compatible; MSK-Gestor/1.0)',
    },
    // @ts-ignore
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`e-Proc retornou ${res.status}`);
  const html = await res.text();

  // ── Parse HTML ────────────────────────────────────────────
  const root = parseHtml(html);

  // Parties
  const partesRows = root.querySelectorAll('#tblPartes tr, #tblPartesPrincipais tr, .infraTrClara, .infraTrEscura');
  const partes: Array<{ nome: string; tipo: string }> = [];
  for (const row of partesRows) {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 2) {
      const nome = cells[0].text.trim().replace(/\s+/g, ' ');
      const tipo = cells[1]?.text.trim() ?? '';
      if (nome && nome.length > 2) partes.push({ nome, tipo });
    }
  }

  // Cause value
  const valorEl = root.querySelector('#tdValorAcao, .tdValorAcao, [id*="Valor"]');
  const valor   = valorEl?.text.trim().replace(/\s+/g, ' ') ?? '';

  // Court (vara)
  const varaEl  = root.querySelector('#txtDescricaoVara, [id*="Vara"], .titVara');
  const vara    = varaEl?.text.trim() ?? '';

  // Judge
  const juizEl  = root.querySelector('[id*="Juiz"], [id*="juiz"], .magistrado');
  const juiz    = juizEl?.text.trim() ?? '';

  // Process class/subject
  const classeEl  = root.querySelector('[id*="Classe"], [id*="classe"], .titClasse');
  const classe    = classeEl?.text.trim() ?? '';

  // Try to detect subject from title
  const titleEl  = root.querySelector('.titProcesso, #fldTitulo h1, title');
  const titulo   = titleEl?.text.trim().replace(/\s+/g, ' ') ?? '';

  // Extract "Autor x Réu" from title
  let parteAdversa = '';
  let clienteNome  = '';
  if (partes.length >= 2) {
    const autor = partes.find(p => /requerente|autor|impetrante|reclamante/i.test(p.tipo));
    const reu   = partes.find(p => /requerido|réu|impetrado|reclamado/i.test(p.tipo));
    clienteNome  = autor?.nome ?? partes[0]?.nome ?? '';
    parteAdversa = reu?.nome  ?? partes[1]?.nome ?? '';
  }

  // Parse valor to number
  const valorNum = valor
    ? parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
    : 0;

  return {
    titulo,
    vara,
    juiz,
    classe,
    parteAdversa,
    clienteNome,
    valorCausa:  valorNum > 0 ? String(valorNum) : '',
    partesRaw:   JSON.stringify(partes),
  };
}

// ── POST /api/eproc/config ────────────────────────────────────

router.post('/config', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'Apenas admin.' }); return; }

  const { tribunal, usuario, senha } = req.body as Record<string, string>;
  if (!tribunal || !usuario || !senha) {
    res.status(400).json({ error: 'tribunal, usuario e senha são obrigatórios.' });
    return;
  }
  if (!EPROC_TRIBUNAIS[tribunal]) {
    res.status(400).json({ error: `Tribunal '${tribunal}' não é suportado.` });
    return;
  }

  const senhaCipher = encrypt(senha);
  const now         = new Date().toISOString();

  db.prepare(`
    INSERT INTO eproc_credentials (tribunal, usuario, senhaCipher, sessionCookie, sessionExp, criadoEm, atualizadoEm)
    VALUES (?, ?, ?, NULL, NULL, ?, ?)
    ON CONFLICT(tribunal) DO UPDATE SET
      usuario       = excluded.usuario,
      senhaCipher   = excluded.senhaCipher,
      sessionCookie = NULL,
      sessionExp    = NULL,
      atualizadoEm  = excluded.atualizadoEm
  `).run(tribunal, usuario, senhaCipher, now, now);

  res.json({ ok: true, tribunal, nome: EPROC_TRIBUNAIS[tribunal].nome });
});

// ── GET /api/eproc/config ─────────────────────────────────────

router.get('/config', requireAuth, (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT tribunal, usuario, atualizadoEm FROM eproc_credentials').all() as any[];
  const result = rows.map(r => ({
    tribunal:    r.tribunal,
    nome:        EPROC_TRIBUNAIS[r.tribunal]?.nome ?? r.tribunal,
    usuario:     r.usuario,
    atualizadoEm: r.atualizadoEm,
  }));
  res.json(result);
});

// ── DELETE /api/eproc/config/:tribunal ───────────────────────

router.delete('/config/:tribunal', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'Apenas admin.' }); return; }
  db.prepare('DELETE FROM eproc_credentials WHERE tribunal = ?').run(req.params.tribunal);
  res.json({ ok: true });
});

// ── POST /api/eproc/consultar ─────────────────────────────────

router.post('/consultar', requireAuth, async (req: Request, res: Response) => {
  const { numeroCNJ, tribunal } = req.body as { numeroCNJ?: string; tribunal?: string };

  if (!numeroCNJ || !tribunal) {
    res.status(400).json({ error: 'numeroCNJ e tribunal são obrigatórios.' });
    return;
  }

  const baseInfo = EPROC_TRIBUNAIS[tribunal];
  if (!baseInfo) {
    res.status(400).json({ error: `Tribunal '${tribunal}' não é suportado pelo e-Proc.` });
    return;
  }

  // Load credentials
  const cred = db.prepare('SELECT * FROM eproc_credentials WHERE tribunal = ?').get(tribunal) as any;
  if (!cred) {
    res.status(404).json({
      error: `Nenhuma credencial configurada para ${baseInfo.nome}. Configure em Configurações → e-Proc.`,
    });
    return;
  }

  try {
    let cookie = cred.sessionCookie as string | null;
    const exp  = cred.sessionExp ? new Date(cred.sessionExp) : null;
    const now  = new Date();

    // Reuse existing session if still valid (within 4 hours)
    const sessionValid = cookie && exp && exp > now;

    if (!sessionValid) {
      console.log(`[eproc] logging in to ${baseInfo.nome} as ${cred.usuario}`);
      const senha = decrypt(cred.senhaCipher);
      cookie = await eprocLogin(baseInfo.url, cred.usuario, senha);

      // Store session for 4 hours
      const expiry = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE eproc_credentials SET sessionCookie=?, sessionExp=? WHERE tribunal=?')
        .run(cookie, expiry, tribunal);
    }

    console.log(`[eproc] querying ${numeroCNJ} at ${baseInfo.nome}`);
    const data = await eprocQueryProcess(baseInfo.url, cookie!, numeroCNJ);

    if (!data.vara && !data.parteAdversa && !data.valorCausa) {
      res.status(404).json({ error: 'Processo não encontrado ou dados insuficientes no e-Proc.' });
      return;
    }

    res.json({ ...data, source: 'eproc', tribunal, tribunalNome: baseInfo.nome });
  } catch (err: any) {
    // Invalidate session on auth errors
    if (err.message?.includes('inválidas') || err.message?.includes('sessão')) {
      db.prepare('UPDATE eproc_credentials SET sessionCookie=NULL, sessionExp=NULL WHERE tribunal=?')
        .run(tribunal);
    }
    console.error('[eproc] erro:', err.message);
    res.status(500).json({ error: err.message ?? 'Erro ao consultar e-Proc.' });
  }
});

// ── GET /api/eproc/tribunais ──────────────────────────────────
// Returns the list of supported e-Proc tribunals (no auth needed)

router.get('/tribunais', (_req: Request, res: Response) => {
  res.json(Object.entries(EPROC_TRIBUNAIS).map(([k, v]) => ({ key: k, nome: v.nome })));
});

export default router;
