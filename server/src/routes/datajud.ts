/**
 * Proxy DataJud — resolve o problema de CORS.
 *
 * O DataJud (api-publica.datajud.cnj.jus.br) não permite chamadas
 * diretas do browser (CORS bloqueado). Esta rota age como proxy:
 * o frontend chama /api/datajud, o servidor chama o DataJud e
 * devolve o resultado ao cliente.
 *
 * POST /api/datajud
 * Body: { tribunalUrl: string, numeroCNJ: string }
 */
import { Router, Request, Response } from 'express';

const router = Router();

const DATAJUD_API_KEY = process.env.DATAJUD_API_KEY ?? 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

router.post('/', async (req: Request, res: Response) => {
  const { tribunalUrl, numeroCNJ } = req.body as Record<string, string>;

  if (!tribunalUrl || !numeroCNJ) {
    res.status(400).json({ error: 'tribunalUrl e numeroCNJ são obrigatórios.' });
    return;
  }

  // Basic URL allowlist — only accept official DataJud endpoints
  if (!tribunalUrl.startsWith('https://api-publica.datajud.cnj.jus.br/')) {
    res.status(400).json({ error: 'URL de tribunal inválida.' });
    return;
  }

  // DataJud stores the process number in different formats depending on the tribunal:
  //   formatted:   5025109-02.2022.8.24.0038
  //   digits only: 50251090220228240038
  // We try both so archived/older processes are found regardless of how they were indexed.
  const digitsOnly = numeroCNJ.replace(/\D/g, '');

  const body = {
    query: {
      bool: {
        should: [
          { term: { 'numeroProcesso.keyword': numeroCNJ } },
          { term: { 'numeroProcesso.keyword': digitsOnly } },
          { match: { numeroProcesso: numeroCNJ } },
          { match: { numeroProcesso: digitsOnly } },
        ],
        minimum_should_match: 1,
      },
    },
    size: 5, // return up to 5 hits (handles edge cases with duplicate entries)
  };

  console.log(`[datajud] ${numeroCNJ} → ${tribunalUrl}`);

  try {
    const upstream = await fetch(tribunalUrl, {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${DATAJUD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // @ts-ignore — Node 18+ native fetch timeout
      signal: AbortSignal.timeout(15_000),
    });

    const text = await upstream.text();
    console.log(`[datajud] status=${upstream.status} body=${text.slice(0, 120)}`);

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `DataJud respondeu ${upstream.status}`,
        detail: text.slice(0, 300),
      });
      return;
    }

    res.json(JSON.parse(text));
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('timeout');
    console.error('[datajud] erro:', err?.message);
    res.status(504).json({
      error: isTimeout ? 'DataJud não respondeu (timeout 15s)' : 'Falha ao conectar ao DataJud',
      detail: err?.message,
    });
  }
});

export default router;
