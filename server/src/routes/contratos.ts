import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/contratos
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM contratos ORDER BY criadoEm DESC').all();
    res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao listar contratos.', detail: msg });
  }
});

// POST /api/contratos
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id   = generateId();
    const now  = new Date().toISOString();

    db.prepare(`INSERT INTO contratos
      (id, clienteId, clienteNome, tipo, valorMensal, percentualExito, valorCausa, descricao,
       areaAtuacao, dataInicio, dataFim, status, observacoes, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, body.clienteId, body.clienteNome, body.tipo,
      body.valorMensal ?? null, body.percentualExito ?? null, body.valorCausa ?? null,
      body.descricao ?? '', body.areaAtuacao ?? '', body.dataInicio,
      body.dataFim ?? null, body.status ?? 'ativo', body.observacoes ?? null,
      body.criadoEm ?? now
    );

    const created = db.prepare('SELECT * FROM contratos WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao criar contrato.', detail: msg });
  }
});

// GET /api/contratos/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM contratos WHERE id = ?').get(req.params.id);
    if (!row) { res.status(404).json({ error: 'Contrato não encontrado.' }); return; }
    res.json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao buscar contrato.', detail: msg });
  }
});

// PUT /api/contratos/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM contratos WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Contrato não encontrado.' }); return; }

    const body = req.body;

    db.prepare(`UPDATE contratos SET
      clienteId=?, clienteNome=?, tipo=?, valorMensal=?, percentualExito=?, valorCausa=?,
      descricao=?, areaAtuacao=?, dataInicio=?, dataFim=?, status=?, observacoes=?
      WHERE id=?`
    ).run(
      body.clienteId ?? existing.clienteId, body.clienteNome ?? existing.clienteNome,
      body.tipo ?? existing.tipo, body.valorMensal ?? existing.valorMensal ?? null,
      body.percentualExito ?? existing.percentualExito ?? null,
      body.valorCausa ?? existing.valorCausa ?? null,
      body.descricao ?? existing.descricao ?? '', body.areaAtuacao ?? existing.areaAtuacao ?? '',
      body.dataInicio ?? existing.dataInicio, body.dataFim ?? existing.dataFim ?? null,
      body.status ?? existing.status, body.observacoes ?? existing.observacoes ?? null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM contratos WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao atualizar contrato.', detail: msg });
  }
});

// DELETE /api/contratos/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM contratos WHERE id = ?').run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: 'Contrato não encontrado.' }); return; }
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao deletar contrato.', detail: msg });
  }
});

export default router;
