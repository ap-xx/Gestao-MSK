import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { db } from '../db/index';

const router = Router();

function getCronCredentials(): { user: string; pass: string } | null {
  // Usa as credenciais do perfil admin para envio de alertas automáticos
  const user = process.env.GMAIL_USER_ADMIN;
  if (!user) return null;

  let pass = '';
  try {
    const row = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get('smtp_admin_pass') as { valor: string } | undefined;
    pass = row?.valor ?? '';
  } catch { /* db pode não estar pronto — ignorar */ }

  if (!pass) {
    pass = process.env.GMAIL_APP_PASSWORD_ADMIN ?? '';
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

// POST /api/cron/email-alertas?secret=CRON_SECRET
// Busca avisos com urgencia 'critica' ou 'alta' não lidos criados nas últimas 24h
// Para cada user com email configurado, envia e-mail de alerta
router.post('/email-alertas', async (req: Request, res: Response) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.query.secret !== secret) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const avisos = db.prepare(`
      SELECT * FROM avisos
      WHERE urgencia IN ('critica', 'alta')
        AND lido = 0
        AND criadoEm >= ?
      ORDER BY urgencia ASC, criadoEm DESC
    `).all(since) as Array<{
      id: string;
      titulo: string;
      descricao: string;
      urgencia: string;
      tipo: string;
      dataLimite: string | null;
      criadoEm: string;
    }>;

    if (avisos.length === 0) {
      res.json({ ok: true, enviados: 0, motivo: 'Nenhum aviso crítico/alto não lido nas últimas 24h.' });
      return;
    }

    // Busca todos os usuários ativos com e-mail
    const users = db.prepare(`
      SELECT id, nome, email, role FROM users WHERE ativo = 1
    `).all() as Array<{ id: string; nome: string; email: string; role: string }>;

    const creds = getCronCredentials();
    if (!creds) {
      res.status(503).json({ error: 'Credenciais de e-mail não configuradas para envio automático.' });
      return;
    }

    const transporter = createTransporter(creds.user, creds.pass);

    const urgenciaLabel: Record<string, string> = {
      critica: 'CRÍTICA',
      alta: 'ALTA',
    };

    const corpoAvisos = avisos.map(a =>
      `• [${urgenciaLabel[a.urgencia] ?? a.urgencia.toUpperCase()}] ${a.titulo}\n  ${a.descricao}${a.dataLimite ? `\n  Prazo: ${a.dataLimite}` : ''}`
    ).join('\n\n');

    let enviados = 0;
    const erros: string[] = [];

    for (const user of users) {
      if (!user.email) continue;
      try {
        await transporter.sendMail({
          from: `"MSK Gestor - Alertas" <${creds.user}>`,
          to: user.email,
          subject: `[MSK Gestor] ${avisos.length} alerta(s) pendente(s) — ação necessária`,
          text: `Olá, ${user.nome}!\n\nVocê tem ${avisos.length} aviso(s) de urgência alta ou crítica pendente(s) nas últimas 24 horas:\n\n${corpoAvisos}\n\nAcesse o sistema para mais detalhes.\n\n---\nMSK Gestor`,
          html: `<p>Olá, <strong>${user.nome}</strong>!</p>
<p>Você tem <strong>${avisos.length}</strong> aviso(s) de urgência alta ou crítica pendente(s) nas últimas 24 horas:</p>
<ul>${avisos.map(a => `<li><strong>[${urgenciaLabel[a.urgencia] ?? a.urgencia.toUpperCase()}]</strong> ${a.titulo} — ${a.descricao}${a.dataLimite ? ` <em>(Prazo: ${a.dataLimite})</em>` : ''}</li>`).join('')}</ul>
<p>Acesse o sistema para mais detalhes.</p>
<hr><small>MSK Gestor</small>`,
        });
        enviados++;
        console.log(`[cron/email] Alerta enviado para ${user.email}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        erros.push(`${user.email}: ${msg}`);
        console.error(`[cron/email] Erro ao enviar para ${user.email}:`, msg);
      }
    }

    res.json({ ok: true, enviados, totalAvisos: avisos.length, erros: erros.length > 0 ? erros : undefined });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao processar cron de e-mail.', detail: msg });
  }
});

export default router;
