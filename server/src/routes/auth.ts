import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findByEmail, verifyPassword, updatePassword } from '../users';
import { requireAuth } from '../middleware/auth';
import { db, generateId } from '../db/index';

const router = Router();

function generateRefreshToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, senha } = req.body as { email?: string; senha?: string };

  if (!email || !senha) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }

  const user = await findByEmail(email);
  if (!user) {
    res.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }

  const ok = await verifyPassword(senha, user.senhaHash);
  if (!ok) {
    res.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  const refreshToken = generateRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO refresh_tokens (id, userId, token, expiresAt, criadoEm)
    VALUES (?, ?, ?, ?, ?)`).run(generateId(), user.id, refreshToken, expiresAt, now.toISOString());

  res.json({
    token,
    refreshToken,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role, ativo: true, criadoEm: new Date().toISOString() },
  });
});

// POST /api/auth/change-password  (requer autenticação)
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  const { senhaAtual, novaSenha } = req.body as { senhaAtual?: string; novaSenha?: string };

  if (!senhaAtual || !novaSenha) {
    res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
    return;
  }

  if (novaSenha.length < 6) {
    res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    return;
  }

  const user = await findByEmail(req.user!.email);
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' });
    return;
  }

  const ok = await verifyPassword(senhaAtual, user.senhaHash);
  if (!ok) {
    res.status(401).json({ error: 'Senha atual incorreta.' });
    return;
  }

  await updatePassword(user.id, novaSenha);
  res.json({ message: 'Senha alterada com sucesso.' });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken é obrigatório.' });
    return;
  }

  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken) as {
    id: string; userId: string; token: string; expiresAt: string; criadoEm: string;
  } | undefined;

  if (!row) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  if (new Date(row.expiresAt) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    res.status(401).json({ error: 'Token expirado.' });
    return;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(row.userId) as {
    id: string; nome: string; email: string; role: string; ativo: number;
  } | undefined;

  if (!userRow || !userRow.ativo) {
    res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
    return;
  }

  // Gera novo JWT e novo refreshToken
  const token = jwt.sign(
    { id: userRow.id, email: userRow.email, role: userRow.role },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  const newRefreshToken = generateRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Deleta o token antigo e insere o novo
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
  db.prepare(`INSERT INTO refresh_tokens (id, userId, token, expiresAt, criadoEm)
    VALUES (?, ?, ?, ?, ?)`).run(generateId(), userRow.id, newRefreshToken, expiresAt, now.toISOString());

  res.json({ token, refreshToken: newRefreshToken });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }

  res.json({ ok: true });
});

export default router;
