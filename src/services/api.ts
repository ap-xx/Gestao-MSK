// ============================================================
// API — dados locais (localStorage) + servidor apenas para
//        Google Calendar e E-mail SMTP
// ============================================================

import {
  UsersDB, EscritoriooDB, generateId,
  getAll, saveAll, SessionDB, LicenseDB, LicensesRegistryDB,
  PrevisoesDB,
} from '../data/db';
import {
  IDBClientes, IDBContratos, IDBProcessos, IDBLancamentos, IDBAviso, IDBPrevisoes,
} from '../data/idb';
import type {
  Cliente, Contrato, Processo, Lancamento, Aviso,
  Escritorio, User, Andamento, LicenseRecord,
  PrevisaoHonorario,
} from '../types';
import { generateLicenseKey, calcDbSizeKb } from '../utils/license';

// ─────────────────────────────────────────────────────────────
// HELPERS LOCAIS
// ─────────────────────────────────────────────────────────────

/** Wraps synchronous localStorage ops in a microtask promise */
const lp = <T>(fn: () => T): Promise<T> => Promise.resolve().then(fn);

// ─────────────────────────────────────────────────────────────
// AUDITORIA LOCAL (localStorage)
// ─────────────────────────────────────────────────────────────

const AUDIT_KEY = 'msk_auditoria';
const AUDIT_MAX = 2_000;

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

function logAudit(
  acao: string,
  entidade: string,
  entidadeId?: string,
  detalhe?: string,
): void {
  try {
    const user = SessionDB.get();
    const entry: AuditEntry = {
      id:        generateId(),
      userId:    user?.id   ?? 'sistema',
      userNome:  user?.nome ?? 'Sistema',
      acao,
      entidade,
      entidadeId,
      detalhe,
      criadoEm:  new Date().toISOString(),
    };
    const all = getAll<AuditEntry>(AUDIT_KEY);
    // Trim oldest entries to stay under the cap
    if (all.length >= AUDIT_MAX) all.splice(0, all.length - AUDIT_MAX + 1);
    all.push(entry);
    saveAll(AUDIT_KEY, all);
  } catch {
    /* never let an audit failure break a CRUD operation */
  }
}

// ─────────────────────────────────────────────────────────────
// HTTP PARA SERVIDOR (Google Calendar + E-mail SMTP)
// ─────────────────────────────────────────────────────────────

// Fallback to the known Render URL so server features work even when
// VITE_API_URL is not set in the Vercel environment variables.
const SERVER_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? 'https://gestao-msk.onrender.com/api';
const TOKEN_KEY   = 'msk_token';
const REFRESH_KEY = 'msk_refresh';

async function serverReq<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  const buildHeaders = (): HeadersInit => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const doFetch = () =>
    fetch(`${SERVER_BASE}${path}`, {
      method,
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

  let res = await doFetch();

  // Auto-refresh JWT on 401 (skip for auth routes to avoid loops)
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (rt) {
      try {
        const rr = await fetch(`${SERVER_BASE}/auth/refresh`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken: rt }),
          signal:  AbortSignal.timeout(10_000),
        });
        if (rr.ok) {
          const tokens = await rr.json();
          sessionStorage.setItem(TOKEN_KEY, tokens.token);
          if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
          res = await doFetch(); // retry original request
        }
      } catch { /* refresh failed — let the 401 propagate */ }
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `Erro ${res.status}`);
  return data as T;
}

// ─────────────────────────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────────────────────────

export const clientesApi = {
  getAll:  () => IDBClientes.getAll(),
  getById: async (id: string) => {
    const c = await IDBClientes.getById(id);
    if (!c) throw new Error('Cliente não encontrado');
    return c;
  },
  create: async (c: Omit<Cliente, 'id'>) => {
    const novo = { ...c, id: generateId() } as Cliente;
    await IDBClientes.insert(novo);
    logAudit('criar', 'cliente', novo.id, novo.nome);
    return novo;
  },
  update: async (id: string, c: Partial<Cliente>) => {
    const updated = await IDBClientes.update(id, c);
    if (!updated) throw new Error('Cliente não encontrado');
    logAudit('atualizar', 'cliente', id, updated.nome);
    return updated;
  },
  remove: async (id: string) => {
    const c = await IDBClientes.getById(id);
    await IDBClientes.remove(id);
    logAudit('excluir', 'cliente', id, c?.nome);
    return { ok: true as const };
  },
};

// ─────────────────────────────────────────────────────────────
// CONTRATOS
// ─────────────────────────────────────────────────────────────

export const contratosApi = {
  getAll:  () => IDBContratos.getAll(),
  getById: async (id: string) => {
    const c = await IDBContratos.getById(id);
    if (!c) throw new Error('Contrato não encontrado');
    return c;
  },
  create: async (c: Omit<Contrato, 'id'>) => {
    const novo = { ...c, id: generateId() } as Contrato;
    await IDBContratos.insert(novo);
    logAudit('criar', 'contrato', novo.id, novo.clienteNome);
    return novo;
  },
  update: async (id: string, c: Partial<Contrato>) => {
    const updated = await IDBContratos.update(id, c);
    if (!updated) throw new Error('Contrato não encontrado');
    logAudit('atualizar', 'contrato', id, updated.clienteNome);
    return updated;
  },
  remove: async (id: string) => {
    const c = await IDBContratos.getById(id);
    await IDBContratos.remove(id);
    logAudit('excluir', 'contrato', id, c?.clienteNome);
    return { ok: true as const };
  },
};

// ─────────────────────────────────────────────────────────────
// PROCESSOS
// ─────────────────────────────────────────────────────────────

export const processosApi = {
  getAll:  () => IDBProcessos.getAll(),
  getById: async (id: string) => {
    const proc = await IDBProcessos.getById(id);
    if (!proc) throw new Error('Processo não encontrado');
    return proc;
  },
  create: async (proc: Omit<Processo, 'id'>) => {
    const novo = { ...proc, id: generateId() } as Processo;
    await IDBProcessos.insert(novo);
    logAudit('criar', 'processo', novo.id, novo.numeroCNJ);
    return novo;
  },
  update: async (id: string, proc: Partial<Processo>) => {
    const updated = await IDBProcessos.update(id, proc);
    if (!updated) throw new Error('Processo não encontrado');
    logAudit('atualizar', 'processo', id, updated.numeroCNJ);
    return updated;
  },
  remove: async (id: string) => {
    const proc = await IDBProcessos.getById(id);
    await IDBProcessos.remove(id);
    logAudit('excluir', 'processo', id, proc?.numeroCNJ);
    return { ok: true as const };
  },
  addAndamento: async (id: string, a: Omit<Andamento, 'id' | 'criadoEm'>) => {
    const proc = await IDBProcessos.getById(id);
    if (!proc) throw new Error('Processo não encontrado');
    const andamento: Andamento = {
      ...a,
      id: generateId(),
      criadoEm: new Date().toISOString(),
    };
    const andamentos = [...(proc.andamentos ?? []), andamento];
    await IDBProcessos.update(id, { andamentos, atualizadoEm: new Date().toISOString() });
    logAudit('andamento', 'processo', id, `${proc.numeroCNJ} — ${a.tipo}`);
    return { andamento };
  },
};

// ─────────────────────────────────────────────────────────────
// LANÇAMENTOS
// ─────────────────────────────────────────────────────────────

export const lancamentosApi = {
  getAll: async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const todos = await IDBLancamentos.getAll();
    const vencidos = todos.filter(
      l => l.status === 'pendente' && l.dataVencimento && l.dataVencimento < hoje,
    );
    if (vencidos.length > 0) {
      // Auto-transition pendente → vencido in bulk
      await Promise.all(vencidos.map(l => IDBLancamentos.update(l.id, { status: 'vencido' })));
      return todos.map(l =>
        vencidos.find(v => v.id === l.id) ? { ...l, status: 'vencido' as const } : l,
      );
    }
    return todos;
  },
  getById: async (id: string) => {
    const l = await IDBLancamentos.getById(id);
    if (!l) throw new Error('Lançamento não encontrado');
    return l;
  },
  create: async (l: Omit<Lancamento, 'id'>) => {
    const novo = { ...l, id: generateId() } as Lancamento;
    await IDBLancamentos.insert(novo);
    logAudit('criar', 'lancamento', novo.id, novo.descricao);
    return novo;
  },
  update: async (id: string, l: Partial<Lancamento>) => {
    const updated = await IDBLancamentos.update(id, l);
    if (!updated) throw new Error('Lançamento não encontrado');
    logAudit('atualizar', 'lancamento', id, updated.descricao);
    return updated;
  },
  remove: async (id: string) => {
    const l = await IDBLancamentos.getById(id);
    await IDBLancamentos.remove(id);
    logAudit('excluir', 'lancamento', id, l?.descricao);
    return { ok: true as const };
  },
};

// ─────────────────────────────────────────────────────────────
// AVISOS
// ─────────────────────────────────────────────────────────────

export const avisosApi = {
  getAll:  () => IDBAviso.getAll(),
  create:  async (a: Omit<Aviso, 'id'>) => {
    const novo = { ...a, id: generateId() } as Aviso;
    await IDBAviso.insert(novo);
    return novo;
  },
  update:  async (id: string, a: Partial<Aviso>) => {
    const updated = await IDBAviso.update(id, a);
    if (!updated) throw new Error('Aviso não encontrado');
    return updated;
  },
  marcarLido: async (id: string) => {
    const updated = await IDBAviso.update(id, { lido: true });
    if (!updated) throw new Error('Aviso não encontrado');
    return updated;
  },
  remove: async (id: string) => {
    await IDBAviso.remove(id);
    return { ok: true as const };
  },
  gerar: async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const em7dias = new Date();
    em7dias.setDate(em7dias.getDate() + 7);
    const fim7 = em7dias.toISOString().slice(0, 10);

    const [processos, lancamentos, existentes] = await Promise.all([
      IDBProcessos.getAll(),
      IDBLancamentos.getAll(),
      IDBAviso.getAll(),
    ]);
    let criados = 0;

    // Audiências nos próximos 7 dias
    for (const proc of processos) {
      if (
        proc.proximaAudiencia &&
        proc.proximaAudiencia >= hoje &&
        proc.proximaAudiencia <= fim7 &&
        proc.status === 'ativo'
      ) {
        const jaExiste = existentes.some(
          a => a.processoId === proc.id && a.tipo === 'audiencia' && !a.lido
        );
        if (!jaExiste) {
          await IDBAviso.insert({
            id: generateId(),
            titulo:    'Audiência próxima',
            descricao: `${proc.clienteNome} — audiência em ${new Date(proc.proximaAudiencia).toLocaleDateString('pt-BR')}.`,
            tipo:      'audiencia',
            urgencia:  'alta',
            processoId: proc.id,
            dataLimite: proc.proximaAudiencia,
            lido:      false,
            criadoEm:  new Date().toISOString(),
          });
          criados++;
        }
      }
    }

    // Inadimplência
    const vencidos = lancamentos.filter(l => l.status === 'vencido' && l.clienteId);
    const porCliente: Record<string, { nome: string; total: number; clienteId: string }> = {};
    for (const l of vencidos) {
      if (!l.clienteId || !l.clienteNome) continue;
      if (!porCliente[l.clienteId])
        porCliente[l.clienteId] = { nome: l.clienteNome, total: 0, clienteId: l.clienteId };
      porCliente[l.clienteId].total += l.valor;
    }
    for (const d of Object.values(porCliente)) {
      const jaExiste = existentes.some(
        a => a.clienteId === d.clienteId && a.tipo === 'pagamento' && !a.lido
      );
      if (!jaExiste) {
        await IDBAviso.insert({
          id: generateId(),
          titulo:    `Inadimplência — ${d.nome}`,
          descricao: `Cliente com valores vencidos totalizando R$ ${d.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          tipo:      'pagamento',
          urgencia:  'alta',
          clienteId: d.clienteId,
          lido:      false,
          criadoEm:  new Date().toISOString(),
        });
        criados++;
      }
    }

    return { criados };
  },
};

// ─────────────────────────────────────────────────────────────
// ESCRITÓRIO
// ─────────────────────────────────────────────────────────────

export const escritorioApi = {
  get: () => lp(() => {
    const e = EscritoriooDB.get();
    if (!e) throw new Error('Escritório não configurado');
    return e;
  }),
  save: (e: Escritorio) => lp(() => {
    EscritoriooDB.save(e);
    logAudit('atualizar', 'escritorio', undefined, e.nome);
    return e;
  }),
};

// ─────────────────────────────────────────────────────────────
// USUÁRIOS
// ─────────────────────────────────────────────────────────────

export const usersApi = {
  getAll: () => lp(() => UsersDB.getAll()),
  create: (u: { nome: string; email: string; role: string; oab?: string; senha: string }) =>
    lp(() => {
      const user: User = {
        id:       generateId(),
        nome:     u.nome,
        email:    u.email,
        role:     u.role as User['role'],
        oab:      u.oab,
        senha:    u.senha,
        ativo:    true,
        criadoEm: new Date().toISOString(),
      };
      const novo = UsersDB.insert(user);
      logAudit('criar', 'usuario', novo.id, novo.nome);
      return novo;
    }),
  update: (id: string, u: Partial<User> & { senha?: string }) =>
    lp(() => {
      const updated = UsersDB.update(id, u);
      if (!updated) throw new Error('Usuário não encontrado');
      logAudit('atualizar', 'usuario', id, updated.nome);
      return updated;
    }),
  remove: (id: string) => lp(() => {
    const u = UsersDB.getById(id);
    UsersDB.remove(id);
    logAudit('excluir', 'usuario', id, u?.nome);
    return { ok: true as const };
  }),
};

// ─────────────────────────────────────────────────────────────
// CONFIG E-MAIL (servidor — fallback gracioso no GET)
// ─────────────────────────────────────────────────────────────

export const configApi = {
  /** Retorna configuração atual; se o servidor estiver dormindo, retorna
   *  todos os perfis como "não configurado" sem lançar erro. */
  getEmail: async () => {
    try {
      return await serverReq<{
        admin:      { user: string; configured: boolean };
        advogado:   { user: string; configured: boolean };
        assistente: { user: string; configured: boolean };
      }>('GET', '/config/email');
    } catch {
      return {
        admin:      { user: '', configured: false },
        advogado:   { user: '', configured: false },
        assistente: { user: '', configured: false },
      };
    }
  },
  /** Salva senha de app no servidor — lança erro se indisponível. */
  setEmail: (role: string, appPassword: string) =>
    serverReq<{ ok: true }>('PUT', '/config/email', { role, appPassword }),
};

// ─────────────────────────────────────────────────────────────
// BACKUP
// ─────────────────────────────────────────────────────────────

export const backupApi = {
  exportar: async () => {
    const [clientes, contratos, processos, lancamentos, avisos] = await Promise.all([
      IDBClientes.getAll(),
      IDBContratos.getAll(),
      IDBProcessos.getAll(),
      IDBLancamentos.getAll(),
      IDBAviso.getAll(),
    ]);
    return {
      clientes, contratos, processos, lancamentos, avisos,
      users:      UsersDB.getAll(),
      escritorio: EscritoriooDB.get(),
      auditoria:  getAll<AuditEntry>(AUDIT_KEY),
      exportadoEm: new Date().toISOString(),
    };
  },
  importar: async (data: any) => {
    // Import into IndexedDB (replacing existing data)
    if (data.clientes)    await IDBClientes.insertBulk(data.clientes);
    if (data.contratos)   await IDBContratos.insertBulk(data.contratos);
    if (data.processos)   await IDBProcessos.insertBulk(data.processos);
    if (data.lancamentos) await IDBLancamentos.insertBulk(data.lancamentos);
    if (data.avisos)      await IDBAviso.insertBulk(data.avisos);
    if (data.users)       saveAll('msk_users', data.users);
    if (data.escritorio)  EscritoriooDB.save(data.escritorio);
    const summary: Record<string, number> = {};
    for (const k of ['clientes', 'contratos', 'processos', 'lancamentos', 'avisos', 'users'] as const) {
      if (data[k]) summary[k] = (data[k] as any[]).length;
    }
    return { ok: true as const, summary };
  },
};

// ─────────────────────────────────────────────────────────────
// GOOGLE CALENDAR (servidor — fallback gracioso no status)
// ─────────────────────────────────────────────────────────────

export const googleApi = {
  /** Obtém URL de autorização OAuth2 — lança erro se servidor indisponível */
  authUrl: () =>
    serverReq<{ url: string }>('GET', '/google/auth-url'),

  /** Retorna status da conexão.
   *  Persiste o último estado conhecido em localStorage para sobreviver a refreshes
   *  quando o servidor está dormindo. */
  status: async () => {
    const CACHE_KEY = 'msk_google_connected';
    try {
      const result = await serverReq<{
        connected: boolean;
        connectedAt?: string;
        calendarId?: string;
      }>('GET', '/google/status');
      // Cache the result
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
      return result;
    } catch {
      // Server unreachable — return last known state
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch { /* malformed cache */ }
      return { connected: false };
    }
  },

  disconnect: async () => {
    const result = await serverReq<{ ok: true }>('DELETE', '/google/disconnect');
    localStorage.removeItem('msk_google_connected');
    return result;
  },
  /** Sync frontend data to Google Calendar.
   *  Sends processos, avisos and contratos from the local IDB so the server
   *  can create/update events even though its own SQLite is empty. */
  sync: async () => {
    const [processos, avisos, contratos] = await Promise.all([
      IDBProcessos.getAll(),
      IDBAviso.getAll(),
      IDBContratos.getAll(),
    ]);
    return serverReq<{ ok: true; synced: number; errors: number }>(
      'POST', '/google/sync',
      {
        processos: processos.map(p => ({
          id: p.id, clienteNome: p.clienteNome, vara: p.vara, status: p.status,
          audiencias: p.audiencias ?? [],
        })),
        avisos: avisos.map(a => ({
          id: a.id, titulo: a.titulo, descricao: a.descricao,
          dataLimite: a.dataLimite, lido: a.lido,
        })),
        contratos: contratos.map(c => ({
          id: c.id, clienteNome: c.clienteNome, tipo: c.tipo,
          dataFim: c.dataFim, status: c.status,
        })),
      },
    );
  },
};

// ─────────────────────────────────────────────────────────────
// e-PROC
// ─────────────────────────────────────────────────────────────

export const eprocApi = {
  /** Returns supported e-Proc tribunal keys (no auth) */
  getTribunais: (): Promise<Array<{ key: string; nome: string }>> =>
    serverReq('GET', '/eproc/tribunais'),

  /** Returns configured tribunals for this account */
  getConfigurados: (): Promise<Array<{ tribunal: string; nome: string; usuario: string; atualizadoEm: string }>> =>
    serverReq('GET', '/eproc/config'),

  /** Save or update credentials for a tribunal */
  salvarCredencial: (tribunal: string, usuario: string, senha: string) =>
    serverReq<{ ok: true; tribunal: string; nome: string }>('POST', '/eproc/config', { tribunal, usuario, senha }),

  /** Remove credentials for a tribunal */
  removerCredencial: (tribunal: string) =>
    serverReq<{ ok: true }>('DELETE', `/eproc/config/${tribunal}`),

  /** Query a process from e-Proc. Returns process data to pre-fill the form. */
  consultar: (numeroCNJ: string, tribunal: string) =>
    serverReq<{
      titulo: string; vara: string; juiz: string; classe: string;
      parteAdversa: string; clienteNome: string; valorCausa: string;
      source: string; tribunal: string; tribunalNome: string;
    }>('POST', '/eproc/consultar', { numeroCNJ, tribunal }),
};

// ─────────────────────────────────────────────────────────────
// PREVISÕES DE HONORÁRIOS
// ─────────────────────────────────────────────────────────────

export const previsoesApi = {
  getAll: async (): Promise<PrevisaoHonorario[]> => {
    const all = await IDBPrevisoes.getAll();
    return all.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  },

  create: async (data: Omit<PrevisaoHonorario, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<PrevisaoHonorario> => {
    const now = new Date().toISOString();
    const item: PrevisaoHonorario = { ...data, id: generateId(), criadoEm: now, atualizadoEm: now };
    await IDBPrevisoes.insert(item);
    logAudit('criar', 'previsao', item.id, item.nome);
    return item;
  },

  update: async (id: string, data: Partial<PrevisaoHonorario>): Promise<PrevisaoHonorario> => {
    const updated = await IDBPrevisoes.update(id, { ...data, atualizadoEm: new Date().toISOString() });
    if (!updated) throw new Error('Previsão não encontrada');
    logAudit('atualizar', 'previsao', id);
    return updated;
  },

  remove: async (id: string): Promise<{ ok: true }> => {
    await IDBPrevisoes.remove(id);
    logAudit('excluir', 'previsao', id);
    return { ok: true as const };
  },
};

// ─────────────────────────────────────────────────────────────
// AUDITORIA (localStorage)
// ─────────────────────────────────────────────────────────────

export const auditoriaApi = {
  /** Lista entradas de auditoria (mais recentes primeiro).
   *  Filtra por entidade quando informada. */
  getAll: (entidade?: string) =>
    lp(() => {
      const all = [...getAll<AuditEntry>(AUDIT_KEY)].reverse();
      return entidade ? all.filter(e => e.entidade === entidade) : all;
    }),

  /**
   * Remove entradas do log de auditoria dentro do intervalo fornecido.
   *
   * @param from  ISO string — remove entradas com criadoEm >= from  (undefined = sem limite inferior)
   * @param to    ISO string — remove entradas com criadoEm <= to    (undefined = sem limite superior)
   * @returns     Número de entradas removidas
   */
  limpar: (from?: string, to?: string): Promise<number> =>
    lp(() => {
      const all = getAll<AuditEntry>(AUDIT_KEY);
      const kept = all.filter(e => {
        const t = e.criadoEm;
        if (from && t < from) return false; // before from → remove
        if (to   && t > to  ) return false; // after to   → remove
        return true;
      });
      const removed = all.length - kept.length;
      saveAll(AUDIT_KEY, kept);
      return removed;
    }),

  /** Apaga todo o log de auditoria */
  limparTudo: (): Promise<number> =>
    lp(() => {
      const count = getAll<AuditEntry>(AUDIT_KEY).length;
      saveAll(AUDIT_KEY, []);
      return count;
    }),

  /** Grava manualmente um evento de auditoria (login, logout, etc.) */
  log: (acao: string, entidade: string, entidadeId?: string, detalhe?: string) =>
    lp(() => logAudit(acao, entidade, entidadeId, detalhe)),
};

// ─────────────────────────────────────────────────────────────
// DOCUMENTOS (base64 em localStorage)
// ─────────────────────────────────────────────────────────────

const DOCS_INDEX_KEY = 'msk_docs_index';
const docsContentKey = (id: string) => `msk_doc_${id}`;

export type CategoriaDocumento =
  | 'contrato' | 'petição' | 'certidão' | 'procuração'
  | 'decisão' | 'comprovante' | 'identidade' | 'outros';

export interface Documento {
  id: string;
  entidade: string;
  entidadeId: string;
  nome: string;
  tipo: string;
  tamanho: number;
  categoria: CategoriaDocumento;
  criadoEm: string;
  criadoPor: string;
}

export const documentosApi = {
  getByEntidade: (entidade: string, entidadeId: string) =>
    lp(() =>
      getAll<Documento>(DOCS_INDEX_KEY).filter(
        d => d.entidade === entidade && d.entidadeId === entidadeId
      )
    ),
  create: (doc: {
    entidade: string; entidadeId: string; nome: string;
    tipo: string; conteudo: string; categoria?: string;
  }) =>
    lp(() => {
      const id = generateId();
      const novo: Documento = {
        id,
        entidade:   doc.entidade,
        entidadeId: doc.entidadeId,
        nome:       doc.nome,
        tipo:       doc.tipo,
        tamanho:    Math.round(doc.conteudo.length * 0.75),
        categoria:  (doc.categoria ?? 'outros') as CategoriaDocumento,
        criadoEm:   new Date().toISOString(),
        criadoPor:  SessionDB.get()?.nome ?? '',
      };
      const index = getAll<Documento>(DOCS_INDEX_KEY);
      index.push(novo);
      saveAll(DOCS_INDEX_KEY, index);
      localStorage.setItem(docsContentKey(id), doc.conteudo);
      logAudit('criar', 'documento', id, `${doc.nome} (${doc.entidade})`);
      return novo;
    }),
  remove: (id: string) =>
    lp(() => {
      const doc = getAll<Documento>(DOCS_INDEX_KEY).find(d => d.id === id);
      saveAll(DOCS_INDEX_KEY, getAll<Documento>(DOCS_INDEX_KEY).filter(d => d.id !== id));
      localStorage.removeItem(docsContentKey(id));
      logAudit('excluir', 'documento', id, doc?.nome);
      return { ok: true as const };
    }),
  download: (id: string) =>
    lp(() => {
      const doc = getAll<Documento>(DOCS_INDEX_KEY).find(d => d.id === id);
      if (!doc) throw new Error('Documento não encontrado');
      const conteudo = localStorage.getItem(docsContentKey(id)) ?? '';
      return { id, nome: doc.nome, tipo: doc.tipo, conteudo };
    }),
};

// ─────────────────────────────────────────────────────────────
// PERFIS / PERMISSÕES (localStorage)
// ─────────────────────────────────────────────────────────────

const PERFIS_KEY = 'msk_perfis';
const PERMS_KEY  = 'msk_permissions';

export interface Perfil {
  id: string;
  nome: string;
  descricao: string;
  modulos: string[];
  criadoEm: string;
}

export const perfisApi = {
  getAll: () => lp(() => getAll<Perfil>(PERFIS_KEY)),
  create: (perfil: { nome: string; descricao?: string; modulos: string[] }) =>
    lp(() => {
      const novo: Perfil = {
        id:        generateId(),
        nome:      perfil.nome,
        descricao: perfil.descricao ?? '',
        modulos:   perfil.modulos,
        criadoEm:  new Date().toISOString(),
      };
      const all = getAll<Perfil>(PERFIS_KEY);
      all.push(novo);
      saveAll(PERFIS_KEY, all);
      logAudit('criar', 'perfil', novo.id, novo.nome);
      return novo;
    }),
  update: (id: string, upd: { nome?: string; descricao?: string; modulos?: string[] }) =>
    lp(() => {
      const all = getAll<Perfil>(PERFIS_KEY);
      const idx = all.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Perfil não encontrado');
      all[idx] = { ...all[idx], ...upd };
      saveAll(PERFIS_KEY, all);
      logAudit('atualizar', 'perfil', id, all[idx].nome);
      return all[idx];
    }),
  remove: (id: string) =>
    lp(() => {
      const item = getAll<Perfil>(PERFIS_KEY).find(x => x.id === id);
      saveAll(PERFIS_KEY, getAll<Perfil>(PERFIS_KEY).filter(x => x.id !== id));
      logAudit('excluir', 'perfil', id, item?.nome);
      return { ok: true as const };
    }),
  getPermissions: () =>
    lp(() => {
      const raw = localStorage.getItem(PERMS_KEY);
      return (raw ? JSON.parse(raw) : {}) as Record<string, string[]>;
    }),
  setPermissions: (perms: Record<string, string[]>) =>
    lp(() => {
      localStorage.setItem(PERMS_KEY, JSON.stringify(perms));
      return { ok: true as const };
    }),
};

// ─────────────────────────────────────────────────────────────
// LICENÇAS
// ─────────────────────────────────────────────────────────────

export const licenseApi = {
  // ── Admin operations (local registry) ────────────────────

  /** Generate a new license key and add it to the local registry */
  generate(descricao?: string): LicenseRecord {
    const key = generateLicenseKey();
    const now = new Date().toISOString();
    const record: LicenseRecord = {
      id:          generateId(),
      key,
      descricao,
      status:      'active',
      criadoEm:    now,
      atualizadoEm: now,
    };
    LicensesRegistryDB.insert(record);
    logAudit('criar', 'licenca', record.id, key);
    return record;
  },

  /** List all license records from local registry */
  getAll(): LicenseRecord[] {
    return LicensesRegistryDB.getAll();
  },

  /** Update description of a license record */
  updateDesc(id: string, descricao: string): void {
    LicensesRegistryDB.update(id, { descricao, atualizadoEm: new Date().toISOString() });
  },

  /** Revoke a license key */
  revoke(id: string): void {
    LicensesRegistryDB.update(id, { status: 'revoked', atualizadoEm: new Date().toISOString() });
    logAudit('revogar', 'licenca', id);
  },

  /** Re-activate a revoked key */
  reactivate(id: string): void {
    LicensesRegistryDB.update(id, { status: 'active', atualizadoEm: new Date().toISOString() });
    logAudit('reativar', 'licenca', id);
  },

  /** Delete a license record entirely */
  delete(id: string): void {
    LicensesRegistryDB.remove(id);
    logAudit('excluir', 'licenca', id);
  },

  /** Merge server-reported machine data into the local registry.
   *
   * If the key already exists locally → update its machine stats.
   * If the key is unknown (was generated on another machine) → insert it,
   * so the admin can see all activated licenses regardless of which PC
   * generated the key.
   */
  mergeServerData(records: LicenseRecord[]): void {
    const now = new Date().toISOString();
    for (const rec of records) {
      const existing = LicensesRegistryDB.getByKey(rec.key);
      if (existing) {
        // Update machine telemetry for a key we already know about
        LicensesRegistryDB.update(existing.id, {
          machineId:    rec.machineId,
          machineName:  rec.machineName,
          cidade:       rec.cidade,
          uf:           rec.uf,
          dbSizeKb:     rec.dbSizeKb,
          lastLogin:    rec.lastLogin,
          loginCount:   rec.loginCount,
          ip:           rec.ip,
          activatedAt:  rec.activatedAt,
          atualizadoEm: now,
        });
      } else {
        // Key was generated on another machine — import it so this registry
        // shows the full picture after a sync
        LicensesRegistryDB.insert({
          id:           rec.id   || generateId(),
          key:          rec.key,
          descricao:    rec.descricao,
          status:       rec.status ?? 'active',
          machineId:    rec.machineId,
          machineName:  rec.machineName,
          cidade:       rec.cidade,
          uf:           rec.uf,
          dbSizeKb:     rec.dbSizeKb,
          lastLogin:    rec.lastLogin,
          loginCount:   rec.loginCount,
          ip:           rec.ip,
          activatedAt:  rec.activatedAt,
          criadoEm:     rec.criadoEm  || now,
          atualizadoEm: now,
        });
      }
    }
  },

  // ── Admin: server sync ────────────────────────────────────

  /** Fetch all machine reports from the server (throws if unreachable) */
  syncFromServer(): Promise<LicenseRecord[]> {
    return serverReq<LicenseRecord[]>('GET', '/licenses');
  },

  // ── Machine operations (on every login) ──────────────────

  /** Update lastLogin + loginCount in localStorage */
  updateLoginStats(): void {
    const lic = LicenseDB.get();
    if (!lic) return;
    LicenseDB.updateStats({
      lastLogin:  new Date().toISOString(),
      loginCount: (lic.loginCount ?? 0) + 1,
    });
  },

  /** Fetch geolocation from ipapi.co (once, when not yet known) */
  async fetchGeo(): Promise<void> {
    const lic = LicenseDB.get();
    if (!lic || lic.cidade) return; // already known
    try {
      const res = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(6_000),
      });
      if (res.ok) {
        const geo = await res.json() as {
          city?: string; region_code?: string; ip?: string;
        };
        LicenseDB.updateStats({ cidade: geo.city, uf: geo.region_code, ip: geo.ip });
      }
    } catch { /* geolocation unavailable — not critical */ }
  },

  /** Report machine stats to the server (fire-and-forget) */
  async reportToServer(): Promise<void> {
    const lic = LicenseDB.get();
    if (!lic) return;
    try {
      await serverReq<unknown>('POST', '/licenses/report', {
        machineId:   lic.machineId,
        machineName: lic.machineName,
        licenseKey:  lic.licenseKey,
        lastLogin:   lic.lastLogin,
        loginCount:  lic.loginCount,
        dbSizeKb:    calcDbSizeKb(),
        activatedAt: lic.activatedAt,
        cidade:      lic.cidade,
        uf:          lic.uf,
      }, 8_000);
    } catch { /* server unavailable — local data intact */ }
  },
};

// ─────────────────────────────────────────────────────────────
// AUTH (token refresh/logout no servidor)
// ─────────────────────────────────────────────────────────────

export const authApi = {
  refresh: (refreshToken: string) =>
    serverReq<{ token: string; refreshToken: string }>(
      'POST', '/auth/refresh', { refreshToken }
    ),
  logout: (refreshToken: string) =>
    serverReq<{ ok: true }>('POST', '/auth/logout', { refreshToken })
      .catch(() => ({ ok: true as const })), // falha silenciosa se servidor dormindo
};
