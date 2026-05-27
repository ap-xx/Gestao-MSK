import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const MODULOS_TODOS = ['dashboard','clientes','contratos','processos','honorarios','agenda','inadimplencia','avisos','configuracoes','relatorios'];

// ── Perfis ────────────────────────────────────────────────────────
// GET /api/perfis
router.get('/', (_req: Request, res: Response) => {
  try {
    const perfis = db.prepare('SELECT * FROM perfis ORDER BY nome').all() as Array<{ id: string; nome: string; descricao: string; modulos: string; criadoEm: string }>;
    res.json(perfis.map(p => ({ ...p, modulos: JSON.parse(p.modulos || '[]') })));
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/perfis
router.post('/', (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return; }
  try {
    const { nome, descricao, modulos } = req.body as { nome: string; descricao?: string; modulos?: string[] };
    if (!nome?.trim()) { res.status(400).json({ error: 'Nome obrigatório.' }); return; }
    const id = generateId();
    db.prepare('INSERT INTO perfis (id, nome, descricao, modulos, criadoEm) VALUES (?, ?, ?, ?, ?)').run(
      id, nome.trim(), descricao ?? '', JSON.stringify(modulos ?? MODULOS_TODOS), new Date().toISOString()
    );
    const created = db.prepare('SELECT * FROM perfis WHERE id = ?').get(id) as any;
    res.status(201).json({ ...created, modulos: JSON.parse(created.modulos) });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/perfis/:id
router.put('/:id', (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return; }
  try {
    const { nome, descricao, modulos } = req.body as { nome?: string; descricao?: string; modulos?: string[] };
    const existing = db.prepare('SELECT * FROM perfis WHERE id = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Perfil não encontrado.' }); return; }
    db.prepare('UPDATE perfis SET nome=?, descricao=?, modulos=? WHERE id=?').run(
      nome ?? existing.nome, descricao ?? existing.descricao,
      modulos ? JSON.stringify(modulos) : existing.modulos, req.params.id
    );
    const updated = db.prepare('SELECT * FROM perfis WHERE id = ?').get(req.params.id) as any;
    res.json({ ...updated, modulos: JSON.parse(updated.modulos) });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/perfis/:id
router.delete('/:id', (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return; }
  try {
    db.prepare('DELETE FROM perfis WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Permissões por role ────────────────────────────────────────────
// GET /api/perfis/permissions — retorna mapa {role: modules[]}
router.get('/permissions', (_req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'permissions'").get() as { valor: string } | undefined;
    if (row) {
      res.json(JSON.parse(row.valor));
    } else {
      // Defaults
      res.json({
        admin:      MODULOS_TODOS,
        advogado:   ['dashboard','clientes','contratos','processos','honorarios','agenda','inadimplencia','avisos','relatorios'],
        assistente: ['dashboard','clientes','avisos','agenda'],
      });
    }
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/perfis/permissions
router.put('/permissions', (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return; }
  try {
    const permissions = req.body as Record<string, string[]>;
    const valor = JSON.stringify(permissions);
    db.prepare("INSERT INTO configuracoes (chave, valor) VALUES ('permissions', ?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").run(valor);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
