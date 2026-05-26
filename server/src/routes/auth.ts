import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findByEmail, verifyPassword, updatePassword } from '../users';
import { requireAuth } from '../middleware/auth';

const router = Router();

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

  res.json({
    token,
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

export default router;
