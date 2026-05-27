import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLogger';

const router = Router();
router.use(requireAuth);

function parseCliente(row: Record<string, unknown>) {
  return {
    ...row,
    endereco: JSON.parse((row.endereco as string) || '{}'),
    socios:   JSON.parse((row.socios   as string) || '[]'),
    ativo:    Boolean(row.ativo),
  };
}

// GET /api/clientes
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM clientes ORDER BY nome').all() as Record<string, unknown>[];
    res.json(rows.map(parseCliente));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao listar clientes.', detail: msg });
  }
});

// POST /api/clientes
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id          = generateId();
    const now         = new Date().toISOString();
    const endereco    = typeof body.endereco === 'object' ? JSON.stringify(body.endereco) : (body.endereco || '{}');
    const socios      = Array.isArray(body.socios) ? JSON.stringify(body.socios) : '[]';

    db.prepare(`INSERT INTO clientes
      (id, tipoPessoa, nome, cpf, cnpj, razaoSocial, email, telefone, celular, status, observacoes,
       endereco, porte, naturezaJuridica, capitalSocial, socios, criadoEm, atualizadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, body.tipoPessoa, body.nome, body.cpf ?? null, body.cnpj ?? null,
      body.razaoSocial ?? null, body.email, body.telefone, body.celular ?? null,
      body.status ?? 'ativo', body.observacoes ?? null,
      endereco, body.porte ?? null, body.naturezaJuridica ?? null, body.capitalSocial ?? null,
      socios, body.criadoEm ?? now, body.atualizadoEm ?? now
    );

    const created = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id) as Record<string, unknown>;
    auditLog({ req, acao: 'CREATE', entidade: 'clientes', entidadeId: id, detalhe: `Nome: ${body.nome}` });
    res.status(201).json(parseCliente(created));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao criar cliente.', detail: msg });
  }
});

// GET /api/clientes/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) { res.status(404).json({ error: 'Cliente não encontrado.' }); return; }
    res.json(parseCliente(row));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao buscar cliente.', detail: msg });
  }
});

// PUT /api/clientes/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Cliente não encontrado.' }); return; }

    const body      = req.body;
    const now       = new Date().toISOString();
    const endereco  = typeof body.endereco === 'object' ? JSON.stringify(body.endereco) : (body.endereco ?? existing.endereco);
    const socios    = Array.isArray(body.socios) ? JSON.stringify(body.socios) : (body.socios ?? existing.socios ?? '[]');

    db.prepare(`UPDATE clientes SET
      tipoPessoa=?, nome=?, cpf=?, cnpj=?, razaoSocial=?, email=?, telefone=?, celular=?,
      status=?, observacoes=?, endereco=?, porte=?, naturezaJuridica=?, capitalSocial=?, socios=?, atualizadoEm=?
      WHERE id=?`
    ).run(
      body.tipoPessoa ?? existing.tipoPessoa, body.nome ?? existing.nome,
      body.cpf ?? existing.cpf ?? null, body.cnpj ?? existing.cnpj ?? null,
      body.razaoSocial ?? existing.razaoSocial ?? null, body.email ?? existing.email,
      body.telefone ?? existing.telefone, body.celular ?? existing.celular ?? null,
      body.status ?? existing.status, body.observacoes ?? existing.observacoes ?? null,
      endereco, body.porte ?? existing.porte ?? null,
      body.naturezaJuridica ?? existing.naturezaJuridica ?? null,
      body.capitalSocial ?? existing.capitalSocial ?? null,
      socios, now, req.params.id
    );

    const updated = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    auditLog({ req, acao: 'UPDATE', entidade: 'clientes', entidadeId: req.params.id, detalhe: `Nome: ${body.nome ?? existing.nome}` });
    res.json(parseCliente(updated));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao atualizar cliente.', detail: msg });
  }
});

// DELETE /api/clientes/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing2 = db.prepare('SELECT nome FROM clientes WHERE id = ?').get(req.params.id) as { nome: string } | undefined;
    const result = db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: 'Cliente não encontrado.' }); return; }
    auditLog({ req, acao: 'DELETE', entidade: 'clientes', entidadeId: req.params.id, detalhe: `Nome: ${existing2?.nome ?? ''}` });
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao deletar cliente.', detail: msg });
  }
});

export default router;
