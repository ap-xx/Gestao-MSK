import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────

function genLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `MSK-${seg()}-${seg()}-${seg()}-${seg()}`;
}

// ─── POST /api/licenses/report ────────────────────────────────
// Called by every machine on each login (fire-and-forget, no JWT).

router.post('/report', (req: Request, res: Response) => {
  const {
    machineId, machineName, licenseKey,
    lastLogin, loginCount, dbSizeKb,
    activatedAt, cidade, uf,
  } = req.body as Record<string, unknown>;

  if (
    typeof machineId   !== 'string' || !machineId ||
    typeof licenseKey  !== 'string' || !licenseKey
  ) {
    res.status(400).json({ error: 'machineId e licenseKey são obrigatórios.' });
    return;
  }

  if (!/^MSK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey as string)) {
    res.status(400).json({ error: 'Formato de chave inválido.' });
    return;
  }

  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
    req.socket.remoteAddress ??
    null;

  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO machine_reports
      (machineId, machineName, licenseKey, activatedAt, lastLogin,
       loginCount, dbSizeKb, cidade, uf, ip, reportedAt)
    VALUES
      (@machineId, @machineName, @licenseKey, @activatedAt, @lastLogin,
       @loginCount, @dbSizeKb, @cidade, @uf, @ip, @reportedAt)
    ON CONFLICT(machineId) DO UPDATE SET
      machineName  = excluded.machineName,
      licenseKey   = excluded.licenseKey,
      lastLogin    = excluded.lastLogin,
      loginCount   = excluded.loginCount,
      dbSizeKb     = excluded.dbSizeKb,
      cidade       = excluded.cidade,
      uf           = excluded.uf,
      ip           = excluded.ip,
      reportedAt   = excluded.reportedAt
  `).run({
    machineId,
    machineName:  machineName  ?? '',
    licenseKey,
    activatedAt:  activatedAt  ?? now,
    lastLogin:    lastLogin    ?? now,
    loginCount:   loginCount   ?? 0,
    dbSizeKb:     dbSizeKb     ?? 0,
    cidade:       cidade       ?? null,
    uf:           uf           ?? null,
    ip,
    reportedAt:   now,
  });

  res.json({ ok: true });
});

// ─── GET /api/licenses ────────────────────────────────────────
// Admin only — returns machine reports joined with key status.

router.get('/', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    return;
  }

  const rows = db.prepare(`
    SELECT mr.*, lk.status as keyStatus, lk.descricao as keyDesc
    FROM machine_reports mr
    LEFT JOIN license_keys lk ON lk.key = mr.licenseKey
    ORDER BY mr.lastLogin DESC
  `).all() as any[];

  const records = rows.map(r => ({
    id:          r.machineId,
    key:         r.licenseKey,
    status:      r.keyStatus ?? 'active',
    descricao:   r.keyDesc   ?? undefined,
    criadoEm:    r.activatedAt ?? r.reportedAt,
    atualizadoEm: r.reportedAt,
    machineId:   r.machineId,
    machineName: r.machineName,
    cidade:      r.cidade ?? undefined,
    uf:          r.uf ?? undefined,
    dbSizeKb:    r.dbSizeKb,
    lastLogin:   r.lastLogin ?? undefined,
    loginCount:  r.loginCount,
    ip:          r.ip ?? undefined,
    activatedAt: r.activatedAt ?? undefined,
  }));

  res.json(records);
});

// ─── GET /api/licenses/keys ───────────────────────────────────
// Admin — lists all server-side generated keys.

router.get('/keys', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'Acesso negado.' }); return; }
  const keys = db.prepare('SELECT * FROM license_keys ORDER BY criadoEm DESC').all();
  res.json(keys);
});

// ─── POST /api/licenses/keys/generate ────────────────────────
// Admin — generates a new key stored server-side.

router.post('/keys/generate', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'Acesso negado.' }); return; }
  const { descricao } = req.body as { descricao?: string };

  const key   = genLicenseKey();
  const id    = generateId();
  const now   = new Date().toISOString();

  db.prepare(
    `INSERT INTO license_keys (id, key, descricao, status, criadoPor, criadoEm, atualizadoEm)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`
  ).run(id, key, descricao ?? '', req.user!.email ?? 'admin', now, now);

  res.json({ id, key, descricao, status: 'active', criadoEm: now });
});

// ─── PATCH /api/licenses/keys/:id/revoke ─────────────────────

router.patch('/keys/:id/revoke', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'Acesso negado.' }); return; }
  db.prepare(`UPDATE license_keys SET status = 'revoked', atualizadoEm = ? WHERE id = ?`)
    .run(new Date().toISOString(), req.params.id);
  res.json({ ok: true });
});

// ─── PATCH /api/licenses/keys/:id/reactivate ─────────────────

router.patch('/keys/:id/reactivate', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'Acesso negado.' }); return; }
  db.prepare(`UPDATE license_keys SET status = 'active', atualizadoEm = ? WHERE id = ?`)
    .run(new Date().toISOString(), req.params.id);
  res.json({ ok: true });
});

// ─── DELETE /api/licenses/:machineId ─────────────────────────

router.delete('/:machineId', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    return;
  }
  db.prepare('DELETE FROM machine_reports WHERE machineId = ?').run(req.params.machineId);
  res.json({ ok: true });
});

// ─── GET /portal ─────────────────────────────────────────────
// Serves the standalone license portal HTML.

router.get('/portal', (_req: Request, res: Response) => {
  const portalPath = path.join(__dirname, '..', '..', 'portal.html');
  if (fs.existsSync(portalPath)) {
    res.sendFile(path.resolve(portalPath));
  } else {
    res.status(404).send('Portal não encontrado.');
  }
});

export default router;
