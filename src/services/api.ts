import type { Cliente, Contrato, Processo, Lancamento, Aviso, Escritorio, User, Andamento } from '../types';

// Em produção (Vercel): VITE_API_URL = https://msk-api.onrender.com/api
// Em desenvolvimento: Vite proxy encaminha /api → localhost:3001
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const TOKEN_KEY    = 'msk_token';
const REFRESH_KEY  = 'msk_refresh';

function authHeaders(): HeadersInit {
  const token = sessionStorage.getItem(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const serialised = body !== undefined ? JSON.stringify(body) : undefined;

  const doFetch = () => fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: serialised,
  });

  let res = await doFetch();

  // Auto-refresh on 401 (skip for auth endpoints to avoid loops)
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      try {
        const rr = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (rr.ok) {
          const tokens = await rr.json();
          sessionStorage.setItem(TOKEN_KEY, tokens.token);
          localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
          res = await doFetch(); // retry original with new token
        }
      } catch {
        // refresh failed — let 401 propagate
      }
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `Erro ${res.status}`);
  return data as T;
}

export const clientesApi = {
  getAll:  ()                                    => req<Cliente[]>('GET', '/clientes'),
  getById: (id: string)                          => req<Cliente>('GET', `/clientes/${id}`),
  create:  (c: Omit<Cliente, 'id'>)             => req<Cliente>('POST', '/clientes', c),
  update:  (id: string, c: Partial<Cliente>)    => req<Cliente>('PUT', `/clientes/${id}`, c),
  remove:  (id: string)                          => req<{ok: true}>('DELETE', `/clientes/${id}`),
};

export const contratosApi = {
  getAll:  ()                                     => req<Contrato[]>('GET', '/contratos'),
  getById: (id: string)                           => req<Contrato>('GET', `/contratos/${id}`),
  create:  (c: Omit<Contrato, 'id'>)             => req<Contrato>('POST', '/contratos', c),
  update:  (id: string, c: Partial<Contrato>)    => req<Contrato>('PUT', `/contratos/${id}`, c),
  remove:  (id: string)                           => req<{ok: true}>('DELETE', `/contratos/${id}`),
};

export const processosApi = {
  getAll:       ()                                          => req<Processo[]>('GET', '/processos'),
  getById:      (id: string)                               => req<Processo>('GET', `/processos/${id}`),
  create:       (p: Omit<Processo, 'id'>)                  => req<Processo>('POST', '/processos', p),
  update:       (id: string, p: Partial<Processo>)         => req<Processo>('PUT', `/processos/${id}`, p),
  remove:       (id: string)                               => req<{ok: true}>('DELETE', `/processos/${id}`),
  addAndamento: (id: string, a: Omit<Andamento, 'id' | 'criadoEm'>) =>
                  req<{andamento: Andamento}>('POST', `/processos/${id}/andamentos`, a),
};

export const lancamentosApi = {
  getAll:  ()                                       => req<Lancamento[]>('GET', '/lancamentos'),
  getById: (id: string)                             => req<Lancamento>('GET', `/lancamentos/${id}`),
  create:  (l: Omit<Lancamento, 'id'>)             => req<Lancamento>('POST', '/lancamentos', l),
  update:  (id: string, l: Partial<Lancamento>)    => req<Lancamento>('PUT', `/lancamentos/${id}`, l),
  remove:  (id: string)                             => req<{ok: true}>('DELETE', `/lancamentos/${id}`),
};

export const avisosApi = {
  getAll:     ()                                    => req<Aviso[]>('GET', '/avisos'),
  create:     (a: Omit<Aviso, 'id'>)               => req<Aviso>('POST', '/avisos', a),
  update:     (id: string, a: Partial<Aviso>)      => req<Aviso>('PUT', `/avisos/${id}`, a),
  marcarLido: (id: string)                          => req<Aviso>('PUT', `/avisos/${id}`, { lido: true }),
  remove:     (id: string)                          => req<{ok: true}>('DELETE', `/avisos/${id}`),
  gerar:      ()                                    => req<{criados: number}>('POST', '/avisos/gerar'),
};

export const escritorioApi = {
  get:  ()                  => req<Escritorio>('GET', '/escritorio'),
  save: (e: Escritorio)     => req<Escritorio>('PUT', '/escritorio', e),
};

export const usersApi = {
  getAll:  ()                                                                      => req<User[]>('GET', '/users'),
  create:  (u: { nome: string; email: string; role: string; oab?: string; senha: string }) =>
             req<User>('POST', '/users', u),
  update:  (id: string, u: Partial<User> & { senha?: string })                    => req<User>('PUT', `/users/${id}`, u),
  remove:  (id: string)                                                            => req<{ok: true}>('DELETE', `/users/${id}`),
};

export const configApi = {
  getEmail: () => req<{
    admin:      { user: string; configured: boolean };
    advogado:   { user: string; configured: boolean };
    assistente: { user: string; configured: boolean };
  }>('GET', '/config/email'),
  setEmail: (role: string, appPassword: string) =>
    req<{ok: true}>('PUT', '/config/email', { role, appPassword }),
};

export const backupApi = {
  exportar: () => req<any>('GET', '/backup'),
  importar: (data: any) => req<{ok: true; summary: Record<string, number>}>('POST', '/backup', data),
};

export const googleApi = {
  authUrl:    () => req<{ url: string }>('GET', '/google/auth-url'),
  status:     () => req<{ connected: boolean; connectedAt?: string; calendarId?: string }>('GET', '/google/status'),
  disconnect: () => req<{ ok: true }>('DELETE', '/google/disconnect'),
  sync:       () => req<{ ok: true; synced: number; errors: number }>('POST', '/google/sync'),
};

// ─── Auditoria ─────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  userId: string;
  userNome: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  detalhe?: string;
  ip?: string;
  criadoEm: string;
}

export const auditoriaApi = {
  getAll: (entidade?: string) =>
    req<AuditEntry[]>('GET', `/auditoria${entidade ? `?entidade=${encodeURIComponent(entidade)}` : ''}`),
};

// ─── Documentos / Anexos ───────────────────────────────────────

export interface Documento {
  id: string;
  entidade: string;
  entidadeId: string;
  nome: string;
  tipo: string;
  tamanho: number;
  criadoEm: string;
  criadoPor: string;
}

export const documentosApi = {
  getByEntidade: (entidade: string, entidadeId: string) =>
    req<Documento[]>('GET', `/documentos?entidade=${encodeURIComponent(entidade)}&entidadeId=${encodeURIComponent(entidadeId)}`),
  create: (doc: { entidade: string; entidadeId: string; nome: string; tipo: string; conteudo: string }) =>
    req<Documento>('POST', '/documentos', doc),
  remove: (id: string) =>
    req<{ ok: true }>('DELETE', `/documentos/${id}`),
  download: (id: string) =>
    req<{ id: string; nome: string; tipo: string; conteudo: string }>('GET', `/documentos/${id}/download`),
};

// ─── Auth refresh ──────────────────────────────────────────────

export const authApi = {
  refresh: (refreshToken: string) =>
    req<{ token: string; refreshToken: string }>('POST', '/auth/refresh', { refreshToken }),
  logout:  (refreshToken: string) =>
    req<{ ok: true }>('POST', '/auth/logout', { refreshToken }),
};
