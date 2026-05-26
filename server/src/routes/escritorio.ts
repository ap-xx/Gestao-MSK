import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/escritorio
router.get('/', (_req: Request, res: Response) => {
  try {
    let row = db.prepare("SELECT dados FROM escritorio WHERE id = 'escritorio'").get() as { dados: string } | undefined;
    if (!row) {
      db.prepare("INSERT INTO escritorio (id, dados) VALUES ('escritorio', '{}')").run();
      row = { dados: '{}' };
    }
    res.json(JSON.parse(row.dados));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao buscar escritório.', detail: msg });
  }
});

// PUT /api/escritorio
router.put('/', (req: Request, res: Response) => {
  try {
    const dados = JSON.stringify(req.body);
    db.prepare(
      "INSERT INTO escritorio (id, dados) VALUES ('escritorio', ?) ON CONFLICT(id) DO UPDATE SET dados = excluded.dados"
    ).run(dados);
    res.json(req.body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao salvar escritório.', detail: msg });
  }
});

export default router;
