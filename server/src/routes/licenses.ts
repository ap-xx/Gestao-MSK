import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ─── POST /api/licenses/report ────────────────────────────────
// Called by every machine on each login (fire-and-forget, no JWT).
// Upserts the machine's stats row.

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

  // Basic format validation — MSK-XXXX-XXXX-XXXX-XXXX
  if (!/^MSK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey as string)) {
    res.status(400).json({ error: 'Formato de chave inválido.' });
    return;
  }

  // Capture the real client IP (works behind Render's proxy)
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
// Admin only — returns all machine reports as LicenseRecord shape.

router.get('/', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    return;
  }

  const rows = db.prepare(`
    SELECT * FROM machine_reports ORDER BY lastLogin DESC
  `).all() as Array<{
    machineId: string;
    machineName: string;
    licenseKey: string;
    activatedAt: string | null;
    lastLogin: string | null;
    loginCount: number;
    dbSizeKb: number;
    cidade: string | null;
    uf: string | null;
    ip: string | null;
    reportedAt: string;
  }>;

  // Shape the response to match LicenseRecord so the frontend can merge it
  const records = rows.map(r => ({
    id:          r.machineId,   // used by mergeServerData to match keys
    key:         r.licenseKey,
    status:      'active' as const,
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

// ─── DELETE /api/licenses/:machineId ─────────────────────────
// Admin only — remove a machine report from the server.

router.delete('/:machineId', requireAuth, (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    return;
  }

  db.prepare('DELETE FROM machine_reports WHERE machineId = ?').run(req.params.machineId);
  res.json({ ok: true });
});

export default router;
