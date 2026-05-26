import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { requireAuth } from '../middleware/auth';

const router = Router();

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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith('re_xxx')) {
    res.status(503).json({ error: 'Serviço de e-mail não configurado.' });
    return;
  }

  const remetente = process.env.EMAIL_REMETENTE || 'onboarding@resend.dev';

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: remetente,
      to: [para],
      subject: assunto,
      html: corpo.replace(/\n/g, '<br>'),
    });

    if (error) {
      console.error('[email] Resend error:', error);
      res.status(502).json({ error: 'Falha ao enviar e-mail.', detail: error.message });
      return;
    }

    res.json({ message: 'E-mail enviado com sucesso.', id: data?.id });
  } catch (err) {
    console.error('[email] Unexpected error:', err);
    res.status(500).json({ error: 'Erro interno ao enviar e-mail.' });
  }
});

export default router;
