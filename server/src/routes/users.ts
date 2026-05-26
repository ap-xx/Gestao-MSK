import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth';
import { findAll, findById, createUser, updateUser, deactivateUser } from '../users';

const router = Router();
router.use(requireAuth);

function adminOnly(req: Request, res: Response): boolean {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return false;
  }
  return true;
}

function stripHash(u: ReturnType<typeof findById>) {
  if (!u) return u;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { senhaHash: _h, ...rest } = u;
  return rest;
}

// GET /api/users
router.get('/', (req: Request, res: Response) => {
  if (!adminOnly(req, res)) return;
  try {
    res.json(findAll().map(stripHash));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao listar usuários.', detail: msg });
  }
});

// POST /api/users
router.post('/', async (req: Request, res: Response) => {
  if (!adminOnly(req, res)) return;
  try {
    const { nome, email, role, oab, senha } = req.body as {
      nome?: string; email?: string; role?: string; oab?: string; senha?: string;
    };
    if (!nome || !email || !role || !senha) {
      res.status(400).json({ error: 'Campos obrigatórios: nome, email, role, senha.' });
      return;
    }
    const senhaHash = await bcrypt.hash(senha, 12);
    const user = createUser({ nome, email, role: role as 'admin' | 'advogado' | 'assistente', oab, senhaHash });
    res.status(201).json(stripHash(user));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao criar usuário.', detail: msg });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response) => {
  if (!adminOnly(req, res)) return;
  try {
    const { nome, email, role, oab, ativo, senha } = req.body as {
      nome?: string; email?: string; role?: string; oab?: string; ativo?: boolean; senha?: string;
    };

    const updates: Record<string, unknown> = {};
    if (nome  !== undefined) updates.nome  = nome;
    if (email !== undefined) updates.email = email;
    if (role  !== undefined) updates.role  = role;
    if (oab   !== undefined) updates.oab   = oab;
    if (ativo !== undefined) updates.ativo = ativo;
    if (senha)               updates.senhaHash = await bcrypt.hash(senha, 12);

    const updated = updateUser(req.params.id, updates as Parameters<typeof updateUser>[1]);
    if (!updated) { res.status(404).json({ error: 'Usuário não encontrado.' }); return; }
    res.json(stripHash(updated));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao atualizar usuário.', detail: msg });
  }
});

// DELETE /api/users/:id  (desativa, não apaga)
router.delete('/:id', (req: Request, res: Response) => {
  if (!adminOnly(req, res)) return;
  try {
    const ok = deactivateUser(req.params.id);
    if (!ok) { res.status(404).json({ error: 'Usuário não encontrado.' }); return; }
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao desativar usuário.', detail: msg });
  }
});

export default router;
