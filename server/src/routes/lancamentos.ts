import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';

const router = Router();
router.use(requireAuth);

// GET /api/lancamentos
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM lancamentos ORDER BY dataVencimento DESC').all();
    res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao listar lançamentos.', detail: msg });
  }
});

// POST /api/lancamentos
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id   = generateId();
    const now  = new Date().toISOString();

    db.prepare(`INSERT INTO lancamentos
      (id, tipo, clienteId, clienteNome, processoId, contratoId, descricao, valor,
       dataVencimento, dataPagamento, status, formaPagamento, observacoes, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, body.tipo, body.clienteId ?? null, body.clienteNome ?? null,
      body.processoId ?? null, body.contratoId ?? null, body.descricao,
      body.valor, body.dataVencimento, body.dataPagamento ?? null,
      body.status ?? 'pendente', body.formaPagamento ?? null, body.observacoes ?? null,
      body.criadoEm ?? now
    );

    const created = db.prepare('SELECT * FROM lancamentos WHERE id = ?').get(id);
    auditLog({ req, acao: 'CREATE', entidade: 'lancamentos', entidadeId: id, detalhe: `${body.tipo}: ${body.descricao} — R$ ${body.valor}` });
    res.status(201).json(created);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao criar lançamento.', detail: msg });
  }
});

// GET /api/lancamentos/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM lancamentos WHERE id = ?').get(req.params.id);
    if (!row) { res.status(404).json({ error: 'Lançamento não encontrado.' }); return; }
    res.json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao buscar lançamento.', detail: msg });
  }
});

// PUT /api/lancamentos/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM lancamentos WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Lançamento não encontrado.' }); return; }

    const body = req.body;

    db.prepare(`UPDATE lancamentos SET
      tipo=?, clienteId=?, clienteNome=?, processoId=?, contratoId=?, descricao=?, valor=?,
      dataVencimento=?, dataPagamento=?, status=?, formaPagamento=?, observacoes=?
      WHERE id=?`
    ).run(
      body.tipo ?? existing.tipo,
      body.clienteId ?? existing.clienteId ?? null,
      body.clienteNome ?? existing.clienteNome ?? null,
      body.processoId ?? existing.processoId ?? null,
      body.contratoId ?? existing.contratoId ?? null,
      body.descricao ?? existing.descricao,
      body.valor ?? existing.valor,
      body.dataVencimento ?? existing.dataVencimento,
      body.dataPagamento !== undefined ? (body.dataPagamento ?? null) : (existing.dataPagamento ?? null),
      body.status ?? existing.status,
      body.formaPagamento !== undefined ? (body.formaPagamento ?? null) : (existing.formaPagamento ?? null),
      body.observacoes !== undefined ? (body.observacoes ?? null) : (existing.observacoes ?? null),
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM lancamentos WHERE id = ?').get(req.params.id);
    auditLog({ req, acao: 'UPDATE', entidade: 'lancamentos', entidadeId: req.params.id, detalhe: `Status: ${body.status ?? existing.status}` });
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao atualizar lançamento.', detail: msg });
  }
});

// DELETE /api/lancamentos/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const toDelete = db.prepare('SELECT descricao FROM lancamentos WHERE id = ?').get(req.params.id) as { descricao: string } | undefined;
    const result = db.prepare('DELETE FROM lancamentos WHERE id = ?').run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: 'Lançamento não encontrado.' }); return; }
    auditLog({ req, acao: 'DELETE', entidade: 'lancamentos', entidadeId: req.params.id, detalhe: toDelete?.descricao });
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao deletar lançamento.', detail: msg });
  }
});

export default router;
