/**
 * TOTP (Time-based One-Time Password) routes — 2FA via Google Authenticator / Authy
 *
 * POST /api/auth/2fa/setup     — generate secret + QR code (requires auth)
 * POST /api/auth/2fa/activate  — verify TOTP and enable 2FA (requires auth)
 * POST /api/auth/2fa/disable   — verify TOTP and disable 2FA (requires auth)
 * POST /api/auth/2fa/verify    — complete login when 2FA is required (public)
 */
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticator } from '@otplib/preset-default';
import QRCode from 'qrcode';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Configure TOTP settings (Google Authenticator compatible)
authenticator.options = { digits: 6, period: 30, algorithm: 'sha1', window: 1 };

function generateRefreshToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// ─── POST /api/auth/2fa/setup ─────────────────────────────────
// Generates a new TOTP secret and returns the QR code URL.
// The user must call /activate to confirm before 2FA is actually enabled.

router.post('/setup', requireAuth, async (req: Request, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) { res.status(404).json({ error: 'Usuário não encontrado.' }); return; }

  if (user.totpEnabled) {
    res.status(409).json({ error: '2FA já está ativado. Desative antes de reconfigurar.' });
    return;
  }

  const secret   = authenticator.generateSecret();
  const appName  = 'MSK Gestor';
  const otpauth  = authenticator.keyuri(user.email, appName, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 220, margin: 1 });

  // Store the TEMP secret — not yet enabled until /activate succeeds
  db.prepare('UPDATE users SET totpSecret = ? WHERE id = ?').run(secret, user.id);

  res.json({ secret, otpauth, qrDataUrl });
});

// ─── POST /api/auth/2fa/activate ─────────────────────────────
// Verifies the first TOTP code and enables 2FA permanently.

router.post('/activate', requireAuth, (req: Request, res: Response) => {
  const { totp } = req.body as { totp?: string };
  if (!totp) { res.status(400).json({ error: 'Código TOTP obrigatório.' }); return; }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user?.totpSecret) {
    res.status(400).json({ error: 'Nenhum segredo configurado. Execute /setup primeiro.' });
    return;
  }

  const valid = authenticator.verify({ token: totp.replace(/\s/g, ''), secret: user.totpSecret });
  if (!valid) {
    res.status(401).json({ error: 'Código inválido. Verifique o horário do dispositivo e tente novamente.' });
    return;
  }

  db.prepare('UPDATE users SET totpEnabled = 1 WHERE id = ?').run(user.id);
  res.json({ ok: true, message: 'Autenticação em dois fatores ativada com sucesso!' });
});

// ─── POST /api/auth/2fa/disable ──────────────────────────────
// Verifies current TOTP and disables 2FA.

router.post('/disable', requireAuth, (req: Request, res: Response) => {
  const { totp } = req.body as { totp?: string };
  if (!totp) { res.status(400).json({ error: 'Código TOTP obrigatório para desativar.' }); return; }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user?.totpEnabled || !user.totpSecret) {
    res.status(400).json({ error: '2FA não está ativado.' });
    return;
  }

  const valid = authenticator.verify({ token: totp.replace(/\s/g, ''), secret: user.totpSecret });
  if (!valid) {
    res.status(401).json({ error: 'Código inválido.' });
    return;
  }

  db.prepare('UPDATE users SET totpEnabled = 0, totpSecret = NULL WHERE id = ?').run(user.id);
  res.json({ ok: true, message: '2FA desativado.' });
});

// ─── POST /api/auth/2fa/verify ────────────────────────────────
// Called after a successful password check when 2FA is required.
// Body: { userId, totp }
// Returns JWT + refreshToken (same as /login when no 2FA).

router.post('/verify', (req: Request, res: Response) => {
  const { userId, totp } = req.body as { userId?: string; totp?: string };

  if (!userId || !totp) {
    res.status(400).json({ error: 'userId e totp são obrigatórios.' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND ativo = 1').get(userId) as any;
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(401).json({ error: 'Usuário inválido ou 2FA não configurado.' });
    return;
  }

  const valid = authenticator.verify({ token: totp.replace(/\s/g, ''), secret: user.totpSecret });
  if (!valid) {
    res.status(401).json({ error: 'Código inválido ou expirado.' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' },
  );

  const refreshToken = generateRefreshToken();
  const now          = new Date();
  const expiresAt    = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO refresh_tokens (id, userId, token, expiresAt, criadoEm)
    VALUES (?, ?, ?, ?, ?)`).run(generateId(), user.id, refreshToken, expiresAt, now.toISOString());

  res.json({
    token,
    refreshToken,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role, ativo: true, totpEnabled: true },
  });
});

export default router;
