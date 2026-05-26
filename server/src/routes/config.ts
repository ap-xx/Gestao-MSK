import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/config/email
router.get('/email', (_req: Request, res: Response) => {
  try {
    const getPass = (key: string) => {
      const row = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(key) as { valor: string } | undefined;
      return row?.valor ?? '';
    };

    const adminPass      = getPass('smtp_admin_pass')      || process.env.GMAIL_APP_PASSWORD_ADMIN      || '';
    const advogadoPass   = getPass('smtp_advogado_pass')   || process.env.GMAIL_APP_PASSWORD_ADVOGADO   || '';
    const assistentePass = getPass('smtp_assistente_pass') || process.env.GMAIL_APP_PASSWORD_ASSISTENTE || '';

    res.json({
      admin:      { user: process.env.GMAIL_USER_ADMIN,      configured: Boolean(adminPass) },
      advogado:   { user: process.env.GMAIL_USER_ADVOGADO,   configured: Boolean(advogadoPass) },
      assistente: { user: process.env.GMAIL_USER_ASSISTENTE, configured: Boolean(assistentePass) },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao buscar configurações de e-mail.', detail: msg });
  }
});

// PUT /api/config/email
router.put('/email', (req: Request, res: Response) => {
  try {
    const { role, appPassword } = req.body as { role?: string; appPassword?: string };
    if (!role || appPassword === undefined) {
      res.status(400).json({ error: 'Campos obrigatórios: role, appPassword.' });
      return;
    }
    const roles = ['admin', 'advogado', 'assistente'];
    if (!roles.includes(role)) {
      res.status(400).json({ error: `Role inválido. Use: ${roles.join(', ')}.` });
      return;
    }
    const chave = `smtp_${role}_pass`;
    db.prepare(
      "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor"
    ).run(chave, appPassword);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao salvar configuração de e-mail.', detail: msg });
  }
});

export default router;
