// ============================================================
// ROTAS — Google Calendar OAuth2
// ============================================================

import { Router } from 'express';
import { google } from 'googleapis';
import { requireAuth } from '../middleware/auth';
import {
  getAuthUrl, saveToken, deleteToken, getToken, fullSyncForUser,
} from '../google/calendar';

const router = Router();

// ── GET /api/google/auth-url — gera URL de consentimento ─────
router.get('/auth-url', requireAuth, (req, res) => {
  const userId = req.user!.id;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Credenciais Google não configuradas no servidor. Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env' });
  }

  const url = getAuthUrl(userId);
  res.json({ url });
});

// ── GET /api/google/callback — recebe code, troca por tokens ─
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.send(popupHtml('error', 'Acesso negado ao Google Calendar.'));
  }

  if (!code || !state) {
    return res.send(popupHtml('error', 'Parâmetros inválidos.'));
  }

  let userId: string;
  try {
    userId = Buffer.from(state, 'base64url').toString('utf8');
  } catch {
    return res.send(popupHtml('error', 'State inválido.'));
  }

  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/google/callback',
    );

    const { tokens } = await auth.getToken(code);
    saveToken(userId, tokens);

    // Dispara sync em background (não bloqueia a resposta)
    auth.setCredentials(tokens);
    fullSyncForUser(userId).catch(err => console.error('[google] Erro no sync inicial:', err));

    return res.send(popupHtml('success', 'Google Calendar conectado com sucesso!'));
  } catch (err) {
    console.error('[google] Erro no callback:', err);
    return res.send(popupHtml('error', 'Erro ao trocar código de autorização.'));
  }
});

// ── GET /api/google/status ────────────────────────────────────
router.get('/status', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const token = getToken(userId);

  if (!token) return res.json({ connected: false });

  res.json({
    connected: true,
    connectedAt: token.connectedAt,
    calendarId: token.calendarId,
  });
});

// ── DELETE /api/google/disconnect ─────────────────────────────
router.delete('/disconnect', requireAuth, (req, res) => {
  const userId = req.user!.id;
  deleteToken(userId);
  res.json({ ok: true });
});

// ── POST /api/google/sync ─────────────────────────────────────
router.post('/sync', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  if (!getToken(userId)) {
    return res.status(400).json({ error: 'Google Calendar não conectado' });
  }

  try {
    const result = await fullSyncForUser(userId);
    res.json({ ok: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    res.status(500).json({ error: msg });
  }
});

// ─── HTML da popup ────────────────────────────────────────────
function popupHtml(type: 'success' | 'error', message: string): string {
  const icon   = type === 'success' ? '✅' : '❌';
  const color  = type === 'success' ? '#22c55e' : '#ef4444';
  const bg     = type === 'success' ? '#052e16' : '#450a0a';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>MSK × Google Calendar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0a0a0a; font-family: system-ui, sans-serif;
    }
    .card {
      background: ${bg}; border: 1px solid ${color}40; border-radius: 12px;
      padding: 32px 40px; text-align: center; max-width: 360px;
    }
    .icon  { font-size: 48px; margin-bottom: 16px; }
    .title { color: ${color}; font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .msg   { color: #a0a0a0; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
    .btn   {
      background: ${color}; color: #fff; border: none; border-radius: 8px;
      padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <div class="title">${type === 'success' ? 'Conectado!' : 'Erro'}</div>
    <p class="msg">${message}${type === 'success' ? ' Esta janela pode ser fechada.' : ''}</p>
    <button class="btn" onclick="window.close()">Fechar</button>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'msk-google-${type}' }, '*');
    }
    ${type === 'success' ? 'setTimeout(() => window.close(), 2000);' : ''}
  </script>
</body>
</html>`;
}

export default router;
