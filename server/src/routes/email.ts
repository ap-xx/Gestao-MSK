import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { requireAuth } from '../middleware/auth';

const router = Router();

function getCredentials(role: string): { user: string; pass: string } | null {
  const map: Record<string, { userKey: string; passKey: string }> = {
    admin:      { userKey: 'GMAIL_USER_ADMIN',      passKey: 'GMAIL_APP_PASSWORD_ADMIN' },
    advogado:   { userKey: 'GMAIL_USER_ADVOGADO',   passKey: 'GMAIL_APP_PASSWORD_ADVOGADO' },
    assistente: { userKey: 'GMAIL_USER_ASSISTENTE', passKey: 'GMAIL_APP_PASSWORD_ASSISTENTE' },
  };

  const entry = map[role];
  if (!entry) return null;

  const user = process.env[entry.userKey];
  const pass = process.env[entry.passKey];
  if (!user || !pass) return null;

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
  } catch (err: any) {
    console.error(`[email] Erro SMTP (${creds.user}):`, err.message);
    res.status(502).json({ error: 'Falha ao enviar e-mail.', detail: err.message });
  }
});

export default router;
