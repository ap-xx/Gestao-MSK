import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { syncAudiencia } from '../google/calendar';
import { auditLog } from '../middleware/auditLogger';

function syncAudiencias(processoId: string, clienteNome: string, vara: string, audiencias: Array<{ data: string; hora?: string; tipo: string; vara?: string; local?: string }>) {
  audiencias.forEach((a, i) => {
    if (!a.data) return;
    syncAudiencia({ processoId, audienciaIndex: i, data: a.data, hora: a.hora, tipo: a.tipo, vara: a.vara ?? vara, local: a.local, clienteNome })
      .catch(err => console.error('[google] Erro sync audiência:', err));
  });
}

const router = Router();
router.use(requireAuth);

function parseProcesso(row: Record<string, unknown>): Record<string, unknown> {
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
    const parsed = parseProcesso(created);
    auditLog({ req, acao: 'CREATE', entidade: 'processos', entidadeId: id, detalhe: `${body.numeroCNJ} — ${body.clienteNome}` });
    // Sync audiências com Google Calendar (background)
    const auds = parsed.audiencias as Array<{ data: string; hora?: string; tipo: string; vara?: string; local?: string }>;
    if (auds?.length) {
      syncAudiencias(id, body.clienteNome ?? '', body.vara ?? '', auds);
    }
    res.status(201).json(parsed);
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

    // Auto-registrar andamento se o status mudou
    if (body.status && body.status !== existing.status) {
      const andamentosArr = JSON.parse((existing.andamentos as string) || '[]');
      const autoAndamento = {
        id: generateId(),
        tipo: 'outro',
        descricao: `Status alterado de "${existing.status}" para "${body.status}"`,
        data: new Date().toISOString().slice(0, 10),
        usuarioNome: (req as any).user?.email ?? 'Sistema',
        criadoEm: new Date().toISOString(),
      };
      andamentosArr.push(autoAndamento);
      db.prepare('UPDATE processos SET andamentos = ? WHERE id = ?').run(
        JSON.stringify(andamentosArr), req.params.id
      );
    }

    const updated = db.prepare('SELECT * FROM processos WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    const parsedUp = parseProcesso(updated);
    // Sync audiências com Google Calendar (background)
    const audsUp = parsedUp.audiencias as Array<{ data: string; hora?: string; tipo: string; vara?: string; local?: string }>;
    if (audsUp?.length) {
      syncAudiencias(req.params.id, parsedUp.clienteNome as string, parsedUp.vara as string, audsUp);
    }
    auditLog({ req, acao: 'UPDATE', entidade: 'processos', entidadeId: req.params.id, detalhe: body.status ? `Status: ${existing.status} → ${body.status}` : `Processo ${existing.numeroCNJ}` });
    res.json(parsedUp);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao atualizar processo.', detail: msg });
  }
});

// DELETE /api/processos/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const toDelProc = db.prepare('SELECT numeroCNJ, clienteNome FROM processos WHERE id = ?').get(req.params.id) as { numeroCNJ: string; clienteNome: string } | undefined;
    const result = db.prepare('DELETE FROM processos WHERE id = ?').run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: 'Processo não encontrado.' }); return; }
    auditLog({ req, acao: 'DELETE', entidade: 'processos', entidadeId: req.params.id, detalhe: toDelProc ? `${toDelProc.numeroCNJ} — ${toDelProc.clienteNome}` : undefined });
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
