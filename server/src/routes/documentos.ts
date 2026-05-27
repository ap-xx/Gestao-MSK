import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// GET /api/documentos?entidade=processos&entidadeId=xxx — lista docs de uma entidade
router.get('/', (req: Request, res: Response) => {
  const { entidade, entidadeId } = req.query as { entidade?: string; entidadeId?: string };

  if (!entidade || !entidadeId) {
    res.status(400).json({ error: 'Parâmetros obrigatórios: entidade e entidadeId.' });
    return;
  }

  try {
    const rows = db.prepare(
      'SELECT id, entidade, entidadeId, nome, tipo, tamanho, categoria, criadoEm, criadoPor FROM documentos WHERE entidade = ? AND entidadeId = ? ORDER BY criadoEm DESC'
    ).all(entidade, entidadeId);
    res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao listar documentos.', detail: msg });
  }
});

// POST /api/documentos — cria novo documento
// Body: { entidade, entidadeId, nome, tipo, conteudo (base64), categoria? }
router.post('/', (req: Request, res: Response) => {
  const { entidade, entidadeId, nome, tipo, conteudo, categoria } = req.body as {
    entidade?: string;
    entidadeId?: string;
    nome?: string;
    tipo?: string;
    conteudo?: string;
    categoria?: string;
  };

  if (!entidade || !entidadeId || !nome || !tipo || !conteudo) {
    res.status(400).json({ error: 'Campos obrigatórios: entidade, entidadeId, nome, tipo, conteudo.' });
    return;
  }

  const tamanho = Buffer.byteLength(conteudo, 'utf8');
  if (tamanho > MAX_SIZE_BYTES) {
    res.status(413).json({ error: 'Arquivo excede o limite de 5MB.' });
    return;
  }

  try {
    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(`INSERT INTO documentos (id, entidade, entidadeId, nome, tipo, tamanho, conteudo, categoria, criadoEm, criadoPor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, entidade, entidadeId, nome, tipo, tamanho, conteudo, categoria ?? 'outros', now, req.user!.id
    );

    const created = db.prepare(
      'SELECT id, entidade, entidadeId, nome, tipo, tamanho, categoria, criadoEm, criadoPor FROM documentos WHERE id = ?'
    ).get(id);
    res.status(201).json(created);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao criar documento.', detail: msg });
  }
});

// GET /api/documentos/:id/download — retorna { id, nome, tipo, conteudo } para download
router.get('/:id/download', (req: Request, res: Response) => {
  try {
    const row = db.prepare(
      'SELECT id, nome, tipo, conteudo FROM documentos WHERE id = ?'
    ).get(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }
    res.json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao buscar documento.', detail: msg });
  }
});

// DELETE /api/documentos/:id — remove documento
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM documentos WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao deletar documento.', detail: msg });
  }
});

export default router;
