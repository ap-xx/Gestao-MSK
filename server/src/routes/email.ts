import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { requireAuth } from '../middleware/auth';

const router = Router();

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
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

  const transporter = createTransporter();
  if (!transporter) {
    res.status(503).json({ error: 'Serviço de e-mail não configurado.' });
    return;
  }

  const remetente = process.env.GMAIL_USER!;

  try {
    const info = await transporter.sendMail({
      from: `"MSK Consultation" <${remetente}>`,
      to: para,
      subject: assunto,
      text: corpo,
      html: corpo.replace(/\n/g, '<br>'),
    });

    console.log(`[email] Enviado para ${para} — ID: ${info.messageId}`);
    res.json({ message: 'E-mail enviado com sucesso.', id: info.messageId });
  } catch (err: any) {
    console.error('[email] Erro SMTP:', err.message);
    res.status(502).json({ error: 'Falha ao enviar e-mail.', detail: err.message });
  }
});

export default router;
