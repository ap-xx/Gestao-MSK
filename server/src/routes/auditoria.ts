import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/auditoria — lista últimos 200 registros (apenas admin)
// Query param opcional: ?entidade=processos
router.get('/', (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return;
  }

  try {
    const { entidade } = req.query as { entidade?: string };

    let rows: unknown[];
    if (entidade) {
      rows = db.prepare(
        'SELECT * FROM audit_log WHERE entidade = ? ORDER BY criadoEm DESC LIMIT 200'
      ).all(entidade);
    } else {
      rows = db.prepare(
        'SELECT * FROM audit_log ORDER BY criadoEm DESC LIMIT 200'
      ).all();
    }

    res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao listar auditoria.', detail: msg });
  }
});

export default router;
