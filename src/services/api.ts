// ============================================================
// API LOCAL — dados persistidos em localStorage (sem servidor)
// ============================================================

import {
  ClientesDB, ContratosDB, ProcessosDB, LancamentosDB,
  AvisosDB, UsersDB, EscritoriooDB, generateId,
  getAll, saveAll,
} from '../data/db';
import type {
  Cliente, Contrato, Processo, Lancamento, Aviso,
  Escritorio, User, Andamento,
} from '../types';

// ── Wrapper assíncrono ────────────────────────────────────────
const lp = <T>(fn: () => T): Promise<T> => Promise.resolve().then(fn);

// ─── Clientes ─────────────────────────────────────────────────
export const clientesApi = {
  getAll:  () => lp(() => ClientesDB.getAll()),
  getById: (id: string) => lp(() => {
    const c = ClientesDB.getById(id);
    if (!c) throw new Error('Cliente não encontrado');
    return c;
  }),
  create:  (c: Omit<Cliente, 'id'>) => lp(() =>
    ClientesDB.insert({ ...c, id: generateId() })
  ),
  update:  (id: string, c: Partial<Cliente>) => lp(() => {
    const updated = ClientesDB.update(id, c);
    if (!updated) throw new Error('Cliente não encontrado');
    return updated;
  }),
  remove:  (id: string) => lp(() => { ClientesDB.remove(id); return { ok: true as const }; }),
};

// ─── Contratos ────────────────────────────────────────────────
export const contratosApi = {
  getAll:  () => lp(() => ContratosDB.getAll()),
  getById: (id: string) => lp(() => {
    const c = ContratosDB.getById(id);
    if (!c) throw new Error('Contrato não encontrado');
    return c;
  }),
  create:  (c: Omit<Contrato, 'id'>) => lp(() =>
    ContratosDB.insert({ ...c, id: generateId() })
  ),
  update:  (id: string, c: Partial<Contrato>) => lp(() => {
    const updated = ContratosDB.update(id, c);
    if (!updated) throw new Error('Contrato não encontrado');
    return updated;
  }),
  remove:  (id: string) => lp(() => { ContratosDB.remove(id); return { ok: true as const }; }),
};

// ─── Processos ────────────────────────────────────────────────
export const processosApi = {
  getAll:  () => lp(() => ProcessosDB.getAll()),
  getById: (id: string) => lp(() => {
    const proc = ProcessosDB.getById(id);
    if (!proc) throw new Error('Processo não encontrado');
    return proc;
  }),
  create:  (proc: Omit<Processo, 'id'>) => lp(() =>
    ProcessosDB.insert({ ...proc, id: generateId() })
  ),
  update:  (id: string, proc: Partial<Processo>) => lp(() => {
    const updated = ProcessosDB.update(id, proc);
    if (!updated) throw new Error('Processo não encontrado');
    return updated;
  }),
  remove:  (id: string) => lp(() => { ProcessosDB.remove(id); return { ok: true as const }; }),
  addAndamento: (id: string, a: Omit<Andamento, 'id' | 'criadoEm'>) => lp(() => {
    const proc = ProcessosDB.getById(id);
    if (!proc) throw new Error('Processo não encontrado');
    const andamento: Andamento = {
      ...a,
      id: generateId(),
      criadoEm: new Date().toISOString(),
    };
    const andamentos = [...(proc.andamentos ?? []), andamento];
    ProcessosDB.update(id, { andamentos, atualizadoEm: new Date().toISOString() });
    return { andamento };
  }),
};

// ─── Lançamentos ──────────────────────────────────────────────
export const lancamentosApi = {
  getAll:  () => lp(() => LancamentosDB.getAll()),
  getById: (id: string) => lp(() => {
    const l = LancamentosDB.getById(id);
    if (!l) throw new Error('Lançamento não encontrado');
    return l;
  }),
  create:  (l: Omit<Lancamento, 'id'>) => lp(() =>
    LancamentosDB.insert({ ...l, id: generateId() })
  ),
  update:  (id: string, l: Partial<Lancamento>) => lp(() => {
    const updated = LancamentosDB.update(id, l);
    if (!updated) throw new Error('Lançamento não encontrado');
    return updated;
  }),
  remove:  (id: string) => lp(() => { LancamentosDB.remove(id); return { ok: true as const }; }),
};

// ─── Avisos ───────────────────────────────────────────────────
export const avisosApi = {
  getAll:     () => lp(() => AvisosDB.getAll()),
  create:     (a: Omit<Aviso, 'id'>) => lp(() =>
    AvisosDB.insert({ ...a, id: generateId() })
  ),
  update:     (id: string, a: Partial<Aviso>) => lp(() => {
    const updated = AvisosDB.update(id, a);
    if (!updated) throw new Error('Aviso não encontrado');
    return updated;
  }),
  marcarLido: (id: string) => lp(() => {
    const updated = AvisosDB.marcarLido(id);
    if (!updated) throw new Error('Aviso não encontrado');
    return updated;
  }),
  remove:     (id: string) => lp(() => { AvisosDB.remove(id); return { ok: true as const }; }),
  gerar: () => lp(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const em7dias = new Date();
    em7dias.setDate(em7dias.getDate() + 7);
    const fim7 = em7dias.toISOString().slice(0, 10);
    const processos = ProcessosDB.getAll();
    const lancamentos = LancamentosDB.getAll();
    const existentes = AvisosDB.getAll();
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
          AvisosDB.insert({
            id: generateId(),
            titulo: 'Audiência próxima',
            descricao: `${proc.clienteNome} — audiência em ${new Date(proc.proximaAudiencia).toLocaleDateString('pt-BR')}.`,
            tipo: 'audiencia',
            urgencia: 'alta',
            processoId: proc.id,
            dataLimite: proc.proximaAudiencia,
            lido: false,
            criadoEm: new Date().toISOString(),
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
    for (const data of Object.values(porCliente)) {
      const jaExiste = existentes.some(
        a => a.clienteId === data.clienteId && a.tipo === 'pagamento' && !a.lido
      );
      if (!jaExiste) {
        AvisosDB.insert({
          id: generateId(),
          titulo: `Inadimplência — ${data.nome}`,
          descricao: `Cliente com valores vencidos totalizando R$ ${data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
          tipo: 'pagamento',
          urgencia: 'alta',
          clienteId: data.clienteId,
          lido: false,
          criadoEm: new Date().toISOString(),
        });
        criados++;
      }
    }

    return { criados };
  }),
};

// ─── Escritório ───────────────────────────────────────────────
export const escritorioApi = {
  get:  () => lp(() => {
    const e = EscritoriooDB.get();
    if (!e) throw new Error('Escritório não configurado');
    return e;
  }),
  save: (e: Escritorio) => lp(() => { EscritoriooDB.save(e); return e; }),
};

// ─── Usuários ─────────────────────────────────────────────────
export const usersApi = {
  getAll: () => lp(() => UsersDB.getAll()),
  create: (u: { nome: string; email: string; role: string; oab?: string; senha: string }) =>
    lp(() => {
      const user: User = {
        id: generateId(),
        nome: u.nome,
        email: u.email,
        role: u.role as User['role'],
        oab: u.oab,
        senha: u.senha,
        ativo: true,
        criadoEm: new Date().toISOString(),
      };
      return UsersDB.insert(user);
    }),
  update: (id: string, u: Partial<User> & { senha?: string }) =>
    lp(() => {
      const updated = UsersDB.update(id, u);
      if (!updated) throw new Error('Usuário não encontrado');
      return updated;
    }),
  remove: (id: string) => lp(() => { UsersDB.remove(id); return { ok: true as const }; }),
};

// ─── Config e-mail (stub — indisponível em modo local) ────────
export const configApi = {
  getEmail: () => lp(() => ({
    admin:      { user: '', configured: false },
    advogado:   { user: '', configured: false },
    assistente: { user: '', configured: false },
  })),
  setEmail: (_role: string, _appPassword: string) => lp(() => ({ ok: true as const })),
};

// ─── Backup ───────────────────────────────────────────────────
export const backupApi = {
  exportar: () => lp(() => ({
    clientes:    ClientesDB.getAll(),
    contratos:   ContratosDB.getAll(),
    processos:   ProcessosDB.getAll(),
    lancamentos: LancamentosDB.getAll(),
    avisos:      AvisosDB.getAll(),
    users:       UsersDB.getAll(),
    escritorio:  EscritoriooDB.get(),
    exportadoEm: new Date().toISOString(),
  })),
  importar: (data: any) => lp(() => {
    if (data.clientes)    saveAll('msk_clientes',    data.clientes);
    if (data.contratos)   saveAll('msk_contratos',   data.contratos);
    if (data.processos)   saveAll('msk_processos',   data.processos);
    if (data.lancamentos) saveAll('msk_lancamentos', data.lancamentos);
    if (data.avisos)      saveAll('msk_avisos',      data.avisos);
    if (data.users)       saveAll('msk_users',       data.users);
    if (data.escritorio)  EscritoriooDB.save(data.escritorio);
    const summary: Record<string, number> = {};
    for (const k of ['clientes', 'contratos', 'processos', 'lancamentos', 'avisos', 'users'] as const) {
      if (data[k]) summary[k] = (data[k] as any[]).length;
    }
    return { ok: true as const, summary };
  }),
};

// ─── Google Calendar (stub — indisponível em modo local) ──────
export const googleApi = {
  authUrl:    () => lp(() => ({ url: '' })),
  status:     () => lp(() => ({ connected: false as const })),
  disconnect: () => lp(() => ({ ok: true as const })),
  sync:       () => lp(() => ({ ok: true as const, synced: 0, errors: 0 })),
};

// ─── Auditoria (stub local — sem servidor) ────────────────────
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
  getAll: (_entidade?: string) => lp(() => [] as AuditEntry[]),
};

// ─── Documentos (base64 em localStorage) ─────────────────────
const DOCS_INDEX_KEY   = 'msk_docs_index';
const docsContentKey   = (id: string) => `msk_doc_${id}`;

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
        entidade: doc.entidade,
        entidadeId: doc.entidadeId,
        nome: doc.nome,
        tipo: doc.tipo,
        tamanho: Math.round(doc.conteudo.length * 0.75), // aprox decoded bytes
        categoria: (doc.categoria ?? 'outros') as CategoriaDocumento,
        criadoEm: new Date().toISOString(),
        criadoPor: '',
      };
      const index = getAll<Documento>(DOCS_INDEX_KEY);
      index.push(novo);
      saveAll(DOCS_INDEX_KEY, index);
      localStorage.setItem(docsContentKey(id), doc.conteudo);
      return novo;
    }),
  remove: (id: string) =>
    lp(() => {
      saveAll(DOCS_INDEX_KEY, getAll<Documento>(DOCS_INDEX_KEY).filter(d => d.id !== id));
      localStorage.removeItem(docsContentKey(id));
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

// ─── Perfis / Permissões (localStorage) ──────────────────────
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
        id: generateId(),
        nome: perfil.nome,
        descricao: perfil.descricao ?? '',
        modulos: perfil.modulos,
        criadoEm: new Date().toISOString(),
      };
      const all = getAll<Perfil>(PERFIS_KEY);
      all.push(novo);
      saveAll(PERFIS_KEY, all);
      return novo;
    }),
  update: (id: string, upd: { nome?: string; descricao?: string; modulos?: string[] }) =>
    lp(() => {
      const all = getAll<Perfil>(PERFIS_KEY);
      const idx = all.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Perfil não encontrado');
      all[idx] = { ...all[idx], ...upd };
      saveAll(PERFIS_KEY, all);
      return all[idx];
    }),
  remove: (id: string) =>
    lp(() => {
      saveAll(PERFIS_KEY, getAll<Perfil>(PERFIS_KEY).filter(x => x.id !== id));
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

// ─── Auth (gerenciado pelo AuthContext via localStorage) ───────
export const authApi = {
  refresh: (_refreshToken: string) => lp(() => ({ token: '', refreshToken: '' })),
  logout:  (_refreshToken: string) => lp(() => ({ ok: true as const })),
};
