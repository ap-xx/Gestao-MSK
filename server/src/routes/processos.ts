import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function parseProcesso(row: Record<string, unknown>) {
  return {
    ...row,
    audiencias:   JSON.parse((row.audiencias   as string) || '[]'),
    andamentos:   JSON.parse((row.andamentos   as string) || '[]'),
    dadosDataJud: row.dadosDataJud ? JSON.parse(row.dadosDataJud as string) : null,
  };
}

// GET /api/processos
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM processos ORDER BY criadoEm DESC').all() as Record<string, unknown>[];
    res.json(rows.map(parseProcesso));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao listar processos.', detail: msg });
  }
});

// POST /api/processos
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id   = generateId();
    const now  = new Date().toISOString();

    db.prepare(`INSERT INTO processos
      (id, numeroCNJ, clienteId, clienteNome, contratoId, tribunal, tribunalAlias, vara, juiz,
       areaAtuacao, fase, polo, parteAdversa, advogadoAdverso, valorCausa, audiencias,
       proximaAudiencia, status, observacoes, andamentos, dadosDataJud, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, body.numeroCNJ, body.clienteId, body.clienteNome,
      body.contratoId ?? null, body.tribunal ?? '', body.tribunalAlias ?? '',
      body.vara ?? '', body.juiz ?? null, body.areaAtuacao ?? '',
      body.fase ?? 'Inicial', body.polo ?? 'Ativo', body.parteAdversa ?? '',
      body.advogadoAdverso ?? null, body.valorCausa ?? null,
      Array.isArray(body.audiencias) ? JSON.stringify(body.audiencias) : '[]',
      body.proximaAudiencia ?? null, body.status ?? 'ativo', body.observacoes ?? null,
      Array.isArray(body.andamentos) ? JSON.stringify(body.andamentos) : '[]',
      body.dadosDataJud ? JSON.stringify(body.dadosDataJud) : null,
      body.criadoEm ?? now, body.atualizadoEm ?? now
    );

    const created = db.prepare('SELECT * FROM processos WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(parseProcesso(created));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao criar processo.', detail: msg });
  }
});

// GET /api/processos/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM processos WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) { res.status(404).json({ error: 'Processo não encontrado.' }); return; }
    res.json(parseProcesso(row));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao buscar processo.', detail: msg });
  }
});

// PUT /api/processos/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM processos WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Processo não encontrado.' }); return; }

    const body = req.body;
    const now  = new Date().toISOString();

    const audiencias = Array.isArray(body.audiencias)
      ? JSON.stringify(body.audiencias)
      : (body.audiencias ?? existing.audiencias ?? '[]');
    const andamentos = Array.isArray(body.andamentos)
      ? JSON.stringify(body.andamentos)
      : (body.andamentos ?? existing.andamentos ?? '[]');
    const dadosDataJud = body.dadosDataJud !== undefined
      ? (body.dadosDataJud ? JSON.stringify(body.dadosDataJud) : null)
      : existing.dadosDataJud;

    db.prepare(`UPDATE processos SET
      numeroCNJ=?, clienteId=?, clienteNome=?, contratoId=?, tribunal=?, tribunalAlias=?, vara=?, juiz=?,
      areaAtuacao=?, fase=?, polo=?, parteAdversa=?, advogadoAdverso=?, valorCausa=?,
      audiencias=?, proximaAudiencia=?, status=?, observacoes=?, andamentos=?, dadosDataJud=?, atualizadoEm=?
      WHERE id=?`
    ).run(
      body.numeroCNJ ?? existing.numeroCNJ, body.clienteId ?? existing.clienteId,
      body.clienteNome ?? existing.clienteNome, body.contratoId ?? existing.contratoId ?? null,
      body.tribunal ?? existing.tribunal ?? '', body.tribunalAlias ?? existing.tribunalAlias ?? '',
      body.vara ?? existing.vara ?? '', body.juiz ?? existing.juiz ?? null,
      body.areaAtuacao ?? existing.areaAtuacao ?? '', body.fase ?? existing.fase ?? 'Inicial',
      body.polo ?? existing.polo ?? 'Ativo', body.parteAdversa ?? existing.parteAdversa ?? '',
      body.advogadoAdverso ?? existing.advogadoAdverso ?? null,
      body.valorCausa ?? existing.valorCausa ?? null,
      audiencias, body.proximaAudiencia ?? existing.proximaAudiencia ?? null,
      body.status ?? existing.status, body.observacoes ?? existing.observacoes ?? null,
      andamentos, dadosDataJud, now, req.params.id
    );

    const updated = db.prepare('SELECT * FROM processos WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json(parseProcesso(updated));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao atualizar processo.', detail: msg });
  }
});

// DELETE /api/processos/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM processos WHERE id = ?').run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: 'Processo não encontrado.' }); return; }
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao deletar processo.', detail: msg });
  }
});

// POST /api/processos/:id/andamentos
router.post('/:id/andamentos', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM processos WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) { res.status(404).json({ error: 'Processo não encontrado.' }); return; }

    const { tipo, descricao, data, usuarioNome } = req.body as {
      tipo?: string; descricao?: string; data?: string; usuarioNome?: string;
    };

    const andamentos: Array<Record<string, unknown>> = JSON.parse((row.andamentos as string) || '[]');
    const andamento = {
      id: generateId(),
      tipo:        tipo        ?? '',
      descricao:   descricao   ?? '',
      data:        data        ?? new Date().toISOString().slice(0, 10),
      usuarioNome: usuarioNome ?? '',
      criadoEm:   new Date().toISOString(),
    };
    andamentos.push(andamento);

    db.prepare('UPDATE processos SET andamentos = ?, atualizadoEm = ? WHERE id = ?').run(
      JSON.stringify(andamentos), new Date().toISOString(), req.params.id
    );

    res.status(201).json({ andamento });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao adicionar andamento.', detail: msg });
  }
});

export default router;
