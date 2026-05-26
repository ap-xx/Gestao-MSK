import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { requireAuth } from '../middleware/auth';
import { db } from '../db/index';

const router = Router();

function getCredentials(role: string): { user: string; pass: string } | null {
  const userMap: Record<string, string> = {
    admin:      'GMAIL_USER_ADMIN',
    advogado:   'GMAIL_USER_ADVOGADO',
    assistente: 'GMAIL_USER_ASSISTENTE',
  };
  const passEnvMap: Record<string, string> = {
    admin:      'GMAIL_APP_PASSWORD_ADMIN',
    advogado:   'GMAIL_APP_PASSWORD_ADVOGADO',
    assistente: 'GMAIL_APP_PASSWORD_ASSISTENTE',
  };

  const userKey = userMap[role];
  if (!userKey) return null;

  const user = process.env[userKey];
  if (!user) return null;

  // 1. Tentar buscar senha na tabela configuracoes
  let pass = '';
  try {
    const row = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(`smtp_${role}_pass`) as { valor: string } | undefined;
    pass = row?.valor ?? '';
  } catch { /* db pode não estar pronto — ignorar */ }

  // 2. Fallback para variável de ambiente
  if (!pass) {
    pass = process.env[passEnvMap[role]] ?? '';
  }

  if (!pass) return null;
  return { user, pass };
}

function createTransporter(user: string, pass: string) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

// POST /api/email/send  (requer autenticação)
router.post('/send', requireAuth, async (req: Request, res: Response) => {
  const { para, assunto, corpo } = req.body as {
    para?: string;
    assunto?: string;
    corpo?: string;
  };

  if (!para || !assunto || !corpo) {
    res.status(400).json({ error: 'Campos obrigatórios: para, assunto, corpo.' });
    return;
  }

  const role = req.user!.role;
  const creds = getCredentials(role);

  if (!creds) {
    res.status(503).json({ error: `E-mail não configurado para o perfil "${role}".` });
    return;
  }

  try {
    const transporter = createTransporter(creds.user, creds.pass);
    const info = await transporter.sendMail({
      from: `"MSK Consultation" <${creds.user}>`,
      to: para,
      subject: assunto,
      text: corpo,
      html: corpo.replace(/\n/g, '<br>'),
    });

    console.log(`[email] Enviado por ${creds.user} para ${para} — ID: ${info.messageId}`);
    res.json({ message: 'E-mail enviado com sucesso.', id: info.messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] Erro SMTP (${creds.user}):`, msg);
    res.status(502).json({ error: 'Falha ao enviar e-mail.', detail: msg });
  }
});

export default router;
