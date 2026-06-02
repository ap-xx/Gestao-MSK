// ============================================================
// BANCO DE DADOS LOCAL — MSK CONSULTATION
// Persistência via localStorage com seed inicial
// ============================================================

import type {
  User, Escritorio, Cliente, Contrato, Processo, Lancamento, Aviso,
  LocalLicense, LicenseRecord,
} from '../types';

const DB_KEYS = {
  users: 'msk_users',
  escritorio: 'msk_escritorio',
  clientes: 'msk_clientes',
  contratos: 'msk_contratos',
  processos: 'msk_processos',
  lancamentos: 'msk_lancamentos',
  avisos: 'msk_avisos',
  currentUser: 'msk_current_user',
  initialized: 'msk_initialized_v4',
  migratedV5:  'msk_initialized_v5',
};

// ─── Funções genéricas de CRUD ────────────────────────────────
export function getAll<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAll<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getById<T extends { id: string }>(key: string, id: string): T | undefined {
  return getAll<T>(key).find((item) => item.id === id);
}

export function insert<T extends { id: string }>(key: string, item: T): T {
  const all = getAll<T>(key);
  all.push(item);
  saveAll(key, all);
  return item;
}

export function update<T extends { id: string }>(key: string, id: string, updates: Partial<T>): T | null {
  const all = getAll<T>(key);
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  saveAll(key, all);
  return all[idx];
}

export function remove<T extends { id: string }>(key: string, id: string): boolean {
  const all = getAll<T>(key);
  const next = all.filter((i) => i.id !== id);
  saveAll(key, next);
  return next.length < all.length;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Usuários ─────────────────────────────────────────────────
export const UsersDB = {
  getAll: () => getAll<User>(DB_KEYS.users),
  getById: (id: string) => getById<User>(DB_KEYS.users, id),
  getByEmail: (email: string) => getAll<User>(DB_KEYS.users).find(u => u.email === email),
  insert: (user: User) => insert<User>(DB_KEYS.users, user),
  update: (id: string, updates: Partial<User>) => update<User>(DB_KEYS.users, id, updates),
  remove: (id: string) => remove<User>(DB_KEYS.users, id),
};

// ─── Escritório ───────────────────────────────────────────────
export const EscritoriooDB = {
  get: (): Escritorio | null => {
    const raw = localStorage.getItem(DB_KEYS.escritorio);
    return raw ? JSON.parse(raw) : null;
  },
  save: (data: Escritorio) => localStorage.setItem(DB_KEYS.escritorio, JSON.stringify(data)),
};

// ─── Clientes ─────────────────────────────────────────────────
export const ClientesDB = {
  getAll: () => getAll<Cliente>(DB_KEYS.clientes),
  getById: (id: string) => getById<Cliente>(DB_KEYS.clientes, id),
  insert: (c: Cliente) => insert<Cliente>(DB_KEYS.clientes, c),
  update: (id: string, u: Partial<Cliente>) => update<Cliente>(DB_KEYS.clientes, id, u),
  remove: (id: string) => remove<Cliente>(DB_KEYS.clientes, id),
};

// ─── Contratos ────────────────────────────────────────────────
export const ContratosDB = {
  getAll: () => getAll<Contrato>(DB_KEYS.contratos),
  getById: (id: string) => getById<Contrato>(DB_KEYS.contratos, id),
  getByCliente: (clienteId: string) => getAll<Contrato>(DB_KEYS.contratos).filter(c => c.clienteId === clienteId),
  insert: (c: Contrato) => insert<Contrato>(DB_KEYS.contratos, c),
  update: (id: string, u: Partial<Contrato>) => update<Contrato>(DB_KEYS.contratos, id, u),
  remove: (id: string) => remove<Contrato>(DB_KEYS.contratos, id),
};

// ─── Processos ────────────────────────────────────────────────
export const ProcessosDB = {
  getAll: () => getAll<Processo>(DB_KEYS.processos),
  getById: (id: string) => getById<Processo>(DB_KEYS.processos, id),
  getByCliente: (clienteId: string) => getAll<Processo>(DB_KEYS.processos).filter(p => p.clienteId === clienteId),
  insert: (p: Processo) => insert<Processo>(DB_KEYS.processos, p),
  update: (id: string, u: Partial<Processo>) => update<Processo>(DB_KEYS.processos, id, u),
  remove: (id: string) => remove<Processo>(DB_KEYS.processos, id),
};

// ─── Lançamentos ──────────────────────────────────────────────
export const LancamentosDB = {
  getAll: () => getAll<Lancamento>(DB_KEYS.lancamentos),
  getById: (id: string) => getById<Lancamento>(DB_KEYS.lancamentos, id),
  getByCliente: (clienteId: string) => getAll<Lancamento>(DB_KEYS.lancamentos).filter(l => l.clienteId === clienteId),
  insert: (l: Lancamento) => insert<Lancamento>(DB_KEYS.lancamentos, l),
  update: (id: string, u: Partial<Lancamento>) => update<Lancamento>(DB_KEYS.lancamentos, id, u),
  remove: (id: string) => remove<Lancamento>(DB_KEYS.lancamentos, id),
};

// ─── Avisos ───────────────────────────────────────────────────
export const AvisosDB = {
  getAll: () => getAll<Aviso>(DB_KEYS.avisos),
  getNaoLidos: () => getAll<Aviso>(DB_KEYS.avisos).filter(a => !a.lido),
  getById: (id: string) => getById<Aviso>(DB_KEYS.avisos, id),
  insert: (a: Aviso) => insert<Aviso>(DB_KEYS.avisos, a),
  update: (id: string, u: Partial<Aviso>) => update<Aviso>(DB_KEYS.avisos, id, u),
  marcarLido: (id: string) => update<Aviso>(DB_KEYS.avisos, id, { lido: true }),
  remove: (id: string) => remove<Aviso>(DB_KEYS.avisos, id),
};

// ─── Sessão ───────────────────────────────────────────────────
export const SessionDB = {
  get: (): User | null => {
    const raw = sessionStorage.getItem(DB_KEYS.currentUser);
    return raw ? JSON.parse(raw) : null;
  },
  set: (user: User) => sessionStorage.setItem(DB_KEYS.currentUser, JSON.stringify(user)),
  clear: () => sessionStorage.removeItem(DB_KEYS.currentUser),
};

// ─── Limpeza de dados de exemplo ──────────────────────────────
// Remove os registros de seed (IDs fixos c1-c5, ct1-ct5, etc.)
// Executado uma única vez quando msk_initialized_v5 ainda não existe.

const SEED_IDS: Array<[string, string[]]> = [
  [DB_KEYS.clientes,    ['c1','c2','c3','c4','c5']],
  [DB_KEYS.contratos,   ['ct1','ct2','ct3','ct4','ct5']],
  [DB_KEYS.processos,   ['p1','p2','p3']],
  [DB_KEYS.lancamentos, ['l1','l2','l3','l4','l5','l6','l7','l8','l9','l10']],
  [DB_KEYS.avisos,      ['av1','av2','av3','av4','av5']],
];

function purgeSeedDataLocal(): void {
  for (const [key, ids] of SEED_IDS) {
    const all = getAll<{ id: string }>(key);
    const purged = all.filter(item => !ids.includes(item.id));
    if (purged.length < all.length) saveAll(key, purged);
  }

  // Reset escritório se ainda contiver o CNPJ falso do seed
  try {
    const raw = localStorage.getItem(DB_KEYS.escritorio);
    if (raw) {
      const e = JSON.parse(raw) as { cnpj?: string };
      if (e.cnpj === '12.345.678/0001-90') {
        const blank = {
          nome: 'MSK Gestor',
          cnpj: '', telefone: '', email: '', site: '',
          endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
          oabPrincipal: '', responsavel: '',
          notificacoes: { emailAlertas: true, whatsappAlertas: true, prazosDias: 5, inadimplenciaAuto: true },
        };
        localStorage.setItem(DB_KEYS.escritorio, JSON.stringify(blank));
      }
    }
  } catch { /* JSON inválido — ignora */ }
}

function runMigrations(): void {
  if (localStorage.getItem(DB_KEYS.migratedV5)) return;
  purgeSeedDataLocal();
  localStorage.setItem(DB_KEYS.migratedV5, 'true');
}

// ─── SEED INICIAL ─────────────────────────────────────────────
export function initializeDatabase(): void {
  // Always run migrations (even on already-initialized installs)
  runMigrations();

  if (localStorage.getItem(DB_KEYS.initialized)) return;

  // Usuários (fallback local — autenticação real via servidor)
  const users: User[] = [
    {
      id: 'u1',
      nome: 'Gabriel Budal Arins',
      email: 'gabrielb.arins@gmail.com',
      senha: 'budal2005msk',
      role: 'admin',
      ativo: true,
      criadoEm: '2024-01-01T00:00:00Z',
    },
    {
      id: 'u2',
      nome: 'Miriam Kuchnier',
      email: 'miriamkuchnier.adv@gmail.com',
      senha: 'advogada3009',
      role: 'advogado',
      ativo: true,
      criadoEm: '2024-02-01T00:00:00Z',
    },
    {
      id: 'u3',
      nome: 'Andre Luiz Budal Arins',
      email: 'andreluizbudalarins@gmail.com',
      senha: 'Gorila@2020',
      role: 'assistente',
      ativo: true,
      criadoEm: '2024-03-01T00:00:00Z',
    },
  ];
  saveAll(DB_KEYS.users, users);

  // Escritório — começa em branco para novas instalações
  const escritorio: Escritorio = {
    nome: 'MSK Gestor',
    cnpj: '', telefone: '', email: '', site: '',
    endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
    oabPrincipal: '', responsavel: '',
    notificacoes: { emailAlertas: true, whatsappAlertas: true, prazosDias: 5, inadimplenciaAuto: true },
  };
  localStorage.setItem(DB_KEYS.escritorio, JSON.stringify(escritorio));

  // Novas instalações começam sem dados de exemplo —
  // os registros de demonstração foram removidos para evitar confusão.
  saveAll(DB_KEYS.clientes, []);
  saveAll(DB_KEYS.contratos, []);
  saveAll(DB_KEYS.processos, []);
  saveAll(DB_KEYS.lancamentos, []);
  saveAll(DB_KEYS.avisos, []);

  localStorage.setItem(DB_KEYS.initialized, 'true');
}

// ─── Licenças ─────────────────────────────────────────────────

const MACHINE_ID_KEY  = 'msk_machine_id';
const LOCAL_LIC_KEY   = 'msk_license';
const LIC_REGISTRY_KEY = 'msk_licenses_registry';

/** Per-machine license stored in this browser's localStorage */
export const LicenseDB = {
  getMachineId(): string {
    let id = localStorage.getItem(MACHINE_ID_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(MACHINE_ID_KEY, id);
    }
    return id;
  },
  get(): LocalLicense | null {
    const raw = localStorage.getItem(LOCAL_LIC_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  set(data: LocalLicense): void {
    localStorage.setItem(LOCAL_LIC_KEY, JSON.stringify(data));
  },
  clear(): void {
    localStorage.removeItem(LOCAL_LIC_KEY);
  },
  updateStats(stats: Partial<LocalLicense>): void {
    const cur = this.get();
    if (cur) this.set({ ...cur, ...stats });
  },
};

/** Registry of generated license keys — stored on the admin's machine */
export const LicensesRegistryDB = {
  getAll:    ()                              => getAll<LicenseRecord>(LIC_REGISTRY_KEY),
  insert:    (r: LicenseRecord)              => insert<LicenseRecord>(LIC_REGISTRY_KEY, r),
  update:    (id: string, u: Partial<LicenseRecord>) =>
    update<LicenseRecord>(LIC_REGISTRY_KEY, id, u),
  remove:    (id: string)                    => remove<LicenseRecord>(LIC_REGISTRY_KEY, id),
  getByKey:  (key: string)                   =>
    getAll<LicenseRecord>(LIC_REGISTRY_KEY).find(r => r.key === key),
};

/** Previsões de honorários (leads/prospectos) */
const PREVISAO_KEY = 'msk_previsoes';
export const PrevisoesDB = {
  getAll:  () => getAll<import('../types').PrevisaoHonorario>(PREVISAO_KEY),
  insert:  (r: import('../types').PrevisaoHonorario) =>
    insert<import('../types').PrevisaoHonorario>(PREVISAO_KEY, r),
  update:  (id: string, u: Partial<import('../types').PrevisaoHonorario>) =>
    update<import('../types').PrevisaoHonorario>(PREVISAO_KEY, id, u),
  remove:  (id: string) => remove<import('../types').PrevisaoHonorario>(PREVISAO_KEY, id),
};

export { DB_KEYS };
