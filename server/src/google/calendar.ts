// ============================================================
// GOOGLE CALENDAR — OAuth2 client + sync helpers
// ============================================================

import { google, calendar_v3 } from 'googleapis';
import { db, generateId } from '../db/index';

const TZ = 'America/Sao_Paulo';

// ─── OAuth2 client factory ────────────────────────────────────

function makeOAuth2() {
  // Default redirect: Vercel frontend OAuth callback page (always online).
  // Overridable via GOOGLE_REDIRECT_URI env var.
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
    ?? `${process.env.FRONTEND_URL ?? 'https://gestao-msk.vercel.app'}/oauth/google`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
}

export function getAuthUrl(userId: string): string {
  const client = makeOAuth2();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: Buffer.from(userId).toString('base64url'),
  });
}

// ─── Token storage ───────────────────────────────────────────

interface GoogleToken {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  calendarId: string;
  connectedAt: string;
}

export function getToken(userId: string): GoogleToken | null {
  return (db.prepare('SELECT * FROM google_tokens WHERE userId = ?').get(userId) as GoogleToken) ?? null;
}

export function saveToken(userId: string, tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}): void {
  const existing = getToken(userId);
  const accessToken  = tokens.access_token  ?? existing?.accessToken  ?? '';
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken ?? '';
  const expiryDate   = tokens.expiry_date   ?? existing?.expiryDate   ?? 0;

  db.prepare(`
    INSERT INTO google_tokens (userId, accessToken, refreshToken, expiryDate, calendarId, connectedAt)
    VALUES (@userId, @accessToken, @refreshToken, @expiryDate, 'primary', @connectedAt)
    ON CONFLICT(userId) DO UPDATE SET
      accessToken  = excluded.accessToken,
      refreshToken = CASE WHEN excluded.refreshToken != '' THEN excluded.refreshToken ELSE google_tokens.refreshToken END,
      expiryDate   = excluded.expiryDate
  `).run({ userId, accessToken, refreshToken, expiryDate, connectedAt: new Date().toISOString() });
}

export function deleteToken(userId: string): void {
  db.prepare('DELETE FROM google_tokens WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM google_events WHERE userId = ?').run(userId);
}

// ─── Calendar client (auto-refresh) ──────────────────────────

async function getCalendar(userId: string): Promise<calendar_v3.Calendar | null> {
  const token = getToken(userId);
  if (!token || !token.refreshToken) return null;

  const auth = makeOAuth2();
  auth.setCredentials({
    access_token:  token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date:   token.expiryDate,
  });

  auth.on('tokens', (newTokens) => {
    saveToken(userId, newTokens);
  });

  return google.calendar({ version: 'v3', auth });
}

// ─── Google Event ID mapping ──────────────────────────────────

function getGoogleEventId(userId: string, entityId: string): string | null {
  const row = db.prepare('SELECT googleEventId FROM google_events WHERE userId = ? AND entityId = ?').get(userId, entityId) as { googleEventId: string } | undefined;
  return row?.googleEventId ?? null;
}

function upsertMapping(userId: string, entityType: string, entityId: string, googleEventId: string): void {
  db.prepare(`
    INSERT INTO google_events (id, userId, entityType, entityId, googleEventId)
    VALUES (@id, @userId, @entityType, @entityId, @googleEventId)
    ON CONFLICT(userId, entityId) DO UPDATE SET googleEventId = excluded.googleEventId
  `).run({ id: generateId(), userId, entityType, entityId, googleEventId });
}

function deleteMapping(userId: string, entityId: string): void {
  db.prepare('DELETE FROM google_events WHERE userId = ? AND entityId = ?').run(userId, entityId);
}

// ─── Event builders ───────────────────────────────────────────

function audienciaEvent(
  data: string, hora: string | undefined, tipo: string,
  clienteNome: string, vara: string, local?: string,
): calendar_v3.Schema$Event {
  const horaFmt = hora ?? '09:00';
  const [h, m] = horaFmt.split(':').map(Number);
  const start = new Date(`${data}T${horaFmt}:00`);
  const end   = new Date(start.getTime() + 60 * 60 * 1000); // +1h

  return {
    summary: `⚖️ Audiência: ${tipo}`,
    description: `Cliente: ${clienteNome}\nLocal: ${local ?? vara}\nVara: ${vara}`,
    location: local ?? vara,
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end:   { dateTime: end.toISOString(),   timeZone: TZ },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 },
        { method: 'popup', minutes: 60  },
      ],
    },
    colorId: '3', // sage / green for audiências
  };
}

function avisoEvent(
  titulo: string, descricao: string, dataLimite: string,
): calendar_v3.Schema$Event {
  return {
    summary: `🔔 ${titulo}`,
    description: descricao,
    start: { date: dataLimite },
    end:   { date: dataLimite },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 },
        { method: 'popup', minutes: 480  },
      ],
    },
    colorId: '11', // tomato / red for prazos/avisos
  };
}

function contratoEvent(
  clienteNome: string, tipo: string, dataFim: string,
): calendar_v3.Schema$Event {
  return {
    summary: `📋 Encerramento de contrato — ${clienteNome}`,
    description: `Contrato tipo ${tipo} com ${clienteNome} encerra nesta data.`,
    start: { date: dataFim },
    end:   { date: dataFim },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 10080 }, // 7 dias
        { method: 'popup', minutes: 1440  },
      ],
    },
    colorId: '9', // blueberry
  };
}

// ─── Upsert a single Google Calendar event ───────────────────

async function upsertEvent(
  cal: calendar_v3.Calendar,
  calendarId: string,
  userId: string,
  entityType: string,
  entityId: string,
  eventBody: calendar_v3.Schema$Event,
): Promise<void> {
  const existingId = getGoogleEventId(userId, entityId);

  if (existingId) {
    try {
      await cal.events.update({ calendarId, eventId: existingId, requestBody: eventBody });
      return;
    } catch {
      // event may have been deleted manually — fall through to create
    }
  }

  const res = await cal.events.insert({ calendarId, requestBody: eventBody });
  if (res.data.id) {
    upsertMapping(userId, entityType, entityId, res.data.id);
  }
}

async function deleteEvent(
  cal: calendar_v3.Calendar,
  calendarId: string,
  userId: string,
  entityId: string,
): Promise<void> {
  const existingId = getGoogleEventId(userId, entityId);
  if (!existingId) return;
  try {
    await cal.events.delete({ calendarId, eventId: existingId });
  } catch { /* already deleted */ }
  deleteMapping(userId, entityId);
}

// ─── All connected users ──────────────────────────────────────

function allConnectedUserIds(): string[] {
  const rows = db.prepare('SELECT userId FROM google_tokens').all() as { userId: string }[];
  return rows.map(r => r.userId);
}

// ─── Public sync functions ────────────────────────────────────

/** Sync a single audiência for all connected users */
export async function syncAudiencia(params: {
  processoId: string;
  audienciaIndex: number;
  data: string;
  hora?: string;
  tipo: string;
  vara: string;
  local?: string;
  clienteNome: string;
  deleted?: boolean;
}): Promise<void> {
  const entityId = `aud-${params.processoId}-${params.audienciaIndex}`;

  await Promise.allSettled(
    allConnectedUserIds().map(async (userId) => {
      const cal = await getCalendar(userId);
      if (!cal) return;
      const { calendarId } = getToken(userId)!;

      if (params.deleted) {
        await deleteEvent(cal, calendarId, userId, entityId);
        return;
      }

      const body = audienciaEvent(
        params.data, params.hora, params.tipo,
        params.clienteNome, params.vara, params.local,
      );
      await upsertEvent(cal, calendarId, userId, 'audiencia', entityId, body);
    }),
  );
}

/** Sync a single aviso for all connected users */
export async function syncAviso(params: {
  id: string;
  titulo: string;
  descricao: string;
  dataLimite: string | null | undefined;
  deleted?: boolean;
}): Promise<void> {
  if (!params.dataLimite) return;
  const entityId = `aviso-${params.id}`;

  await Promise.allSettled(
    allConnectedUserIds().map(async (userId) => {
      const cal = await getCalendar(userId);
      if (!cal) return;
      const { calendarId } = getToken(userId)!;

      if (params.deleted) {
        await deleteEvent(cal, calendarId, userId, entityId);
        return;
      }

      const body = avisoEvent(params.titulo, params.descricao, params.dataLimite!);
      await upsertEvent(cal, calendarId, userId, 'aviso', entityId, body);
    }),
  );
}

/** Sync a single contrato encerramento for all connected users */
export async function syncContrato(params: {
  id: string;
  clienteNome: string;
  tipo: string;
  dataFim: string | null | undefined;
  deleted?: boolean;
}): Promise<void> {
  if (!params.dataFim) return;
  const entityId = `contrato-${params.id}`;

  await Promise.allSettled(
    allConnectedUserIds().map(async (userId) => {
      const cal = await getCalendar(userId);
      if (!cal) return;
      const { calendarId } = getToken(userId)!;

      if (params.deleted) {
        await deleteEvent(cal, calendarId, userId, entityId);
        return;
      }

      const body = contratoEvent(params.clienteNome, params.tipo, params.dataFim!);
      await upsertEvent(cal, calendarId, userId, 'contrato', entityId, body);
    }),
  );
}

// ─── Full sync ──────────────────────────────────────────────
// Accepts optional client-side data payload. When provided, uses it instead
// of the server's SQLite tables (which are empty in a frontend-first setup).

export interface SyncPayload {
  processos?: Array<{
    id: string; clienteNome: string; vara: string; status: string;
    audiencias: Array<{ data: string; hora?: string; tipo: string; vara?: string; local?: string }>;
  }>;
  avisos?: Array<{
    id: string; titulo: string; descricao: string; dataLimite?: string; lido: boolean;
  }>;
  contratos?: Array<{
    id: string; clienteNome: string; tipo: string; dataFim?: string; status: string;
  }>;
}

export async function fullSyncForUser(
  userId: string,
  payload?: SyncPayload,
): Promise<{ synced: number; errors: number }> {
  const cal = await getCalendar(userId);
  if (!cal) throw new Error('Usuário não conectado ao Google Calendar');
  const { calendarId } = getToken(userId)!;

  let synced = 0;
  let errors = 0;

  // ── Processos / Audiências ────────────────────────────────
  let processos: SyncPayload['processos'];
  if (payload?.processos) {
    processos = payload.processos.filter(p => p.status === 'ativo');
  } else {
    type ProcessoRow = { id: string; clienteNome: string; vara: string; audiencias: string };
    processos = (db.prepare('SELECT id, clienteNome, vara, audiencias FROM processos WHERE status = ?').all('ativo') as ProcessoRow[])
      .map(p => {
        let audiencias: any[] = [];
        try { audiencias = JSON.parse(p.audiencias); } catch { /* ignore */ }
        return { ...p, audiencias };
      });
  }

  for (const p of processos ?? []) {
    for (let i = 0; i < p.audiencias.length; i++) {
      const a = p.audiencias[i];
      if (!a.data) continue;
      try {
        const body = audienciaEvent(a.data, a.hora, a.tipo, p.clienteNome, a.vara ?? p.vara, a.local);
        await upsertEvent(cal, calendarId, userId, 'audiencia', `aud-${p.id}-${i}`, body);
        synced++;
      } catch { errors++; }
    }
  }

  // ── Avisos ────────────────────────────────────────────────
  let avisos: SyncPayload['avisos'];
  if (payload?.avisos) {
    avisos = payload.avisos.filter(a => a.dataLimite && !a.lido);
  } else {
    type AvisoRow = { id: string; titulo: string; descricao: string; dataLimite: string; lido: number };
    avisos = (db.prepare('SELECT id, titulo, descricao, dataLimite, lido FROM avisos WHERE dataLimite IS NOT NULL AND lido = 0').all() as AvisoRow[])
      .map(av => ({ ...av, lido: Boolean(av.lido), dataLimite: av.dataLimite ?? undefined }));
  }

  for (const av of avisos ?? []) {
    if (!av.dataLimite) continue;
    try {
      const body = avisoEvent(av.titulo, av.descricao, av.dataLimite);
      await upsertEvent(cal, calendarId, userId, 'aviso', `aviso-${av.id}`, body);
      synced++;
    } catch { errors++; }
  }

  // ── Contratos ─────────────────────────────────────────────
  let contratos: SyncPayload['contratos'];
  if (payload?.contratos) {
    contratos = payload.contratos.filter(c => c.status === 'ativo' && c.dataFim);
  } else {
    type ContratoRow = { id: string; clienteNome: string; tipo: string; dataFim: string };
    contratos = db.prepare("SELECT id, clienteNome, tipo, dataFim FROM contratos WHERE status = 'ativo' AND dataFim IS NOT NULL").all() as ContratoRow[];
  }

  for (const c of contratos ?? []) {
    if (!c.dataFim) continue;
    try {
      const body = contratoEvent(c.clienteNome, c.tipo, c.dataFim);
      await upsertEvent(cal, calendarId, userId, 'contrato', `contrato-${c.id}`, body);
      synced++;
    } catch { errors++; }
  }

  return { synced, errors };
}
