// ============================================================
// BANCO DE DADOS LOCAL — MSK CONSULTATION
// Persistência via localStorage com seed inicial
// ============================================================

import type {
  User, Escritorio, Cliente, Contrato, Processo, Lancamento, Aviso
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
  initialized: 'msk_initialized_v3',
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

// ─── SEED INICIAL ─────────────────────────────────────────────
export function initializeDatabase(): void {
  if (localStorage.getItem(DB_KEYS.initialized)) return;

  // Usuários
  const users: User[] = [
    {
      id: '1',
      nome: 'Dr. Marcus Silveira Klemm',
      email: 'admin@msk.adv.br',
      senha: 'admin123',
      role: 'admin',
      oab: 'SP 123456',
      ativo: true,
      criadoEm: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      nome: 'Dra. Ana Paula Ferreira',
      email: 'ana@msk.adv.br',
      senha: 'ana123',
      role: 'advogado',
      oab: 'SP 234567',
      ativo: true,
      criadoEm: '2024-02-01T00:00:00Z',
    },
    {
      id: '3',
      nome: 'Lucas Mendes',
      email: 'lucas@msk.adv.br',
      senha: 'lucas123',
      role: 'assistente',
      ativo: true,
      criadoEm: '2024-03-01T00:00:00Z',
    },
  ];
  saveAll(DB_KEYS.users, users);

  // Escritório
  const escritorio: Escritorio = {
    nome: 'MSK Consultation Advocacia',
    cnpj: '12.345.678/0001-90',
    telefone: '(11) 3456-7890',
    email: 'contato@msk.adv.br',
    site: 'www.msk.adv.br',
    endereco: {
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: 'Conj. 501',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
    },
    oabPrincipal: 'SP 123456',
    responsavel: 'Dr. Marcus Silveira Klemm',
    notificacoes: {
      emailAlertas: true,
      whatsappAlertas: true,
      prazosDias: 5,
      inadimplenciaAuto: true,
    },
  };
  localStorage.setItem(DB_KEYS.escritorio, JSON.stringify(escritorio));

  // Clientes
  const clientes: Cliente[] = [
    {
      id: 'c1',
      tipoPessoa: 'PF',
      nome: 'João Carlos Mendonça',
      cpf: '123.456.789-00',
      email: 'joao@email.com',
      telefone: '(11) 98765-4321',
      status: 'ativo',
      endereco: {
        cep: '01310-100',
        logradouro: 'Rua das Flores',
        numero: '123',
        bairro: 'Jardim Europa',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      criadoEm: '2024-01-15T10:00:00Z',
      atualizadoEm: '2024-01-15T10:00:00Z',
    },
    {
      id: 'c2',
      tipoPessoa: 'PJ',
      nome: 'Tech Solutions Ltda',
      cnpj: '23.456.789/0001-01',
      razaoSocial: 'Tech Solutions Serviços de Tecnologia Ltda',
      email: 'contato@techsolutions.com.br',
      telefone: '(11) 3333-4444',
      status: 'ativo',
      porte: 'MEDIO',
      naturezaJuridica: 'Sociedade Empresária Limitada',
      capitalSocial: 'R$ 500.000,00',
      endereco: {
        cep: '04538-133',
        logradouro: 'Rua Joaquim Floriano',
        numero: '100',
        complemento: 'CJ 301',
        bairro: 'Itaim Bibi',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      criadoEm: '2024-02-10T14:00:00Z',
      atualizadoEm: '2024-02-10T14:00:00Z',
    },
    {
      id: 'c3',
      tipoPessoa: 'PF',
      nome: 'Maria Fernanda Costa',
      cpf: '987.654.321-00',
      email: 'maria@email.com',
      telefone: '(21) 99876-5432',
      status: 'ativo',
      endereco: {
        cep: '22041-001',
        logradouro: 'Av. Atlântica',
        numero: '500',
        bairro: 'Copacabana',
        cidade: 'Rio de Janeiro',
        uf: 'RJ',
      },
      criadoEm: '2024-03-05T09:00:00Z',
      atualizadoEm: '2024-03-05T09:00:00Z',
    },
    {
      id: 'c4',
      tipoPessoa: 'PJ',
      nome: 'Construtora Vale Verde S/A',
      cnpj: '34.567.890/0001-12',
      razaoSocial: 'Construtora Vale Verde S/A',
      email: 'juridico@valeverde.com.br',
      telefone: '(11) 4444-5555',
      status: 'ativo',
      porte: 'GRANDE',
      naturezaJuridica: 'Sociedade Anônima Fechada',
      capitalSocial: 'R$ 10.000.000,00',
      endereco: {
        cep: '01402-001',
        logradouro: 'Alameda Santos',
        numero: '2000',
        bairro: 'Cerqueira César',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      criadoEm: '2024-01-20T11:00:00Z',
      atualizadoEm: '2024-01-20T11:00:00Z',
    },
    {
      id: 'c5',
      tipoPessoa: 'PF',
      nome: 'Roberto Augusto Pinheiro',
      cpf: '456.789.123-00',
      email: 'roberto@email.com',
      telefone: '(31) 97654-3210',
      status: 'bloqueado',
      endereco: {
        cep: '30130-110',
        logradouro: 'Rua da Bahia',
        numero: '75',
        bairro: 'Centro',
        cidade: 'Belo Horizonte',
        uf: 'MG',
      },
      criadoEm: '2024-04-01T08:00:00Z',
      atualizadoEm: '2024-04-01T08:00:00Z',
    },
  ];
  saveAll(DB_KEYS.clientes, clientes);

  // Contratos
  const contratos: Contrato[] = [
    {
      id: 'ct1',
      clienteId: 'c1',
      clienteNome: 'João Carlos Mendonça',
      tipo: 'Mensal',
      valorMensal: 3500,
      descricao: 'Assessoria jurídica trabalhista',
      areaAtuacao: 'Trabalhista',
      dataInicio: '2024-01-15',
      status: 'ativo',
      criadoEm: '2024-01-15T10:00:00Z',
    },
    {
      id: 'ct2',
      clienteId: 'c2',
      clienteNome: 'Tech Solutions Ltda',
      tipo: 'Mensal',
      valorMensal: 8000,
      descricao: 'Consultoria jurídica empresarial e contratos',
      areaAtuacao: 'Empresarial',
      dataInicio: '2024-02-10',
      status: 'ativo',
      criadoEm: '2024-02-10T14:00:00Z',
    },
    {
      id: 'ct3',
      clienteId: 'c3',
      clienteNome: 'Maria Fernanda Costa',
      tipo: 'Êxito',
      percentualExito: 20,
      valorCausa: 150000,
      descricao: 'Ação de danos morais — acidente de trânsito',
      areaAtuacao: 'Cível',
      dataInicio: '2024-03-05',
      status: 'ativo',
      criadoEm: '2024-03-05T09:00:00Z',
    },
    {
      id: 'ct4',
      clienteId: 'c4',
      clienteNome: 'Construtora Vale Verde S/A',
      tipo: 'Misto',
      valorMensal: 15000,
      percentualExito: 10,
      valorCausa: 2000000,
      descricao: 'Assessoria jurídica + litígios imobiliários',
      areaAtuacao: 'Imobiliário',
      dataInicio: '2024-01-20',
      status: 'ativo',
      criadoEm: '2024-01-20T11:00:00Z',
    },
    {
      id: 'ct5',
      clienteId: 'c5',
      clienteNome: 'Roberto Augusto Pinheiro',
      tipo: 'Avulso',
      descricao: 'Ação de inventário',
      areaAtuacao: 'Família e Sucessões',
      dataInicio: '2024-04-01',
      status: 'suspenso',
      criadoEm: '2024-04-01T08:00:00Z',
    },
  ];
  saveAll(DB_KEYS.contratos, contratos);

  // Processos
  const processos: Processo[] = [
    {
      id: 'p1',
      numeroCNJ: '1234567-89.2024.8.26.0100',
      clienteId: 'c1',
      clienteNome: 'João Carlos Mendonça',
      contratoId: 'ct1',
      tribunal: 'Tribunal de Justiça de São Paulo',
      tribunalAlias: 'tjsp',
      vara: '5ª Vara do Trabalho de São Paulo',
      areaAtuacao: 'Trabalhista',
      fase: 'Instrução',
      polo: 'Ativo',
      parteAdversa: 'Empresa XYZ Comércio Ltda',
      advogadoAdverso: 'Dr. Carlos Pinto',
      valorCausa: 45000,
      audiencias: [
        {
          data: '2026-08-15',
          hora: '14:00',
          tipo: 'Audiência de Instrução',
          local: 'Fórum Trabalhista de SP',
          vara: '5ª VT',
        },
      ],
      proximaAudiencia: '2026-08-15',
      ultimaMovimentacao: '2026-05-01',
      status: 'ativo',
      criadoEm: '2024-01-15T10:00:00Z',
      atualizadoEm: '2026-05-01T00:00:00Z',
    },
    {
      id: 'p2',
      numeroCNJ: '9876543-21.2024.8.26.0100',
      clienteId: 'c3',
      clienteNome: 'Maria Fernanda Costa',
      contratoId: 'ct3',
      tribunal: 'Tribunal de Justiça do Rio de Janeiro',
      tribunalAlias: 'tjrj',
      vara: '3ª Vara Cível da Comarca do Rio de Janeiro',
      areaAtuacao: 'Cível',
      fase: 'Conhecimento',
      polo: 'Ativo',
      parteAdversa: 'Seguradora Nacional S/A',
      valorCausa: 150000,
      audiencias: [
        {
          data: '2026-09-10',
          hora: '10:30',
          tipo: 'Audiência de Conciliação',
          local: 'Fórum Central RJ',
        },
      ],
      proximaAudiencia: '2026-09-10',
      ultimaMovimentacao: '2026-04-20',
      status: 'ativo',
      criadoEm: '2024-03-05T09:00:00Z',
      atualizadoEm: '2026-04-20T00:00:00Z',
    },
    {
      id: 'p3',
      numeroCNJ: '5555555-55.2023.8.26.0100',
      clienteId: 'c4',
      clienteNome: 'Construtora Vale Verde S/A',
      contratoId: 'ct4',
      tribunal: 'Tribunal de Justiça de São Paulo',
      tribunalAlias: 'tjsp',
      vara: '1ª Vara de Falências e Recuperações Judiciais',
      areaAtuacao: 'Imobiliário',
      fase: 'Recursal',
      polo: 'Passivo',
      parteAdversa: 'Condomínio Residencial Park Hills',
      valorCausa: 2000000,
      audiencias: [],
      ultimaMovimentacao: '2026-05-05',
      status: 'ativo',
      criadoEm: '2024-01-20T11:00:00Z',
      atualizadoEm: '2026-05-05T00:00:00Z',
    },
  ];
  saveAll(DB_KEYS.processos, processos);

  // Lançamentos
  const lancamentos: Lancamento[] = [
    {
      id: 'l1',
      tipo: 'recebimento',
      clienteId: 'c1',
      clienteNome: 'João Carlos Mendonça',
      contratoId: 'ct1',
      descricao: 'Honorários mensais — Abril/2026',
      valor: 3500,
      dataVencimento: '2026-04-05',
      dataPagamento: '2026-04-04',
      status: 'pago',
      formaPagamento: 'PIX',
      criadoEm: '2026-04-01T00:00:00Z',
    },
    {
      id: 'l2',
      tipo: 'recebimento',
      clienteId: 'c2',
      clienteNome: 'Tech Solutions Ltda',
      contratoId: 'ct2',
      descricao: 'Honorários mensais — Abril/2026',
      valor: 8000,
      dataVencimento: '2026-04-10',
      dataPagamento: '2026-04-09',
      status: 'pago',
      formaPagamento: 'TED',
      criadoEm: '2026-04-01T00:00:00Z',
    },
    {
      id: 'l3',
      tipo: 'a_receber',
      clienteId: 'c4',
      clienteNome: 'Construtora Vale Verde S/A',
      contratoId: 'ct4',
      descricao: 'Honorários mensais — Maio/2026',
      valor: 15000,
      dataVencimento: '2026-05-10',
      status: 'pendente',
      criadoEm: '2026-05-01T00:00:00Z',
    },
    {
      id: 'l4',
      tipo: 'recebimento',
      clienteId: 'c1',
      clienteNome: 'João Carlos Mendonça',
      contratoId: 'ct1',
      descricao: 'Honorários mensais — Maio/2026',
      valor: 3500,
      dataVencimento: '2026-05-05',
      dataPagamento: '2026-05-05',
      status: 'pago',
      formaPagamento: 'PIX',
      criadoEm: '2026-05-01T00:00:00Z',
    },
    {
      id: 'l5',
      tipo: 'a_receber',
      clienteId: 'c5',
      clienteNome: 'Roberto Augusto Pinheiro',
      descricao: 'Parcela 1/3 — Ação de Inventário',
      valor: 5000,
      dataVencimento: '2026-02-01',
      status: 'vencido',
      criadoEm: '2026-01-15T00:00:00Z',
    },
    {
      id: 'l6',
      tipo: 'a_receber',
      clienteId: 'c5',
      clienteNome: 'Roberto Augusto Pinheiro',
      descricao: 'Parcela 2/3 — Ação de Inventário',
      valor: 5000,
      dataVencimento: '2026-03-01',
      status: 'vencido',
      criadoEm: '2026-01-15T00:00:00Z',
    },
    {
      id: 'l7',
      tipo: 'despesa',
      descricao: 'Aluguel do escritório — Maio/2026',
      valor: 8500,
      dataVencimento: '2026-05-05',
      status: 'pendente',
      criadoEm: '2026-05-01T00:00:00Z',
    },
    {
      id: 'l8',
      tipo: 'despesa',
      descricao: 'Custas processuais — Processo Construtora',
      valor: 2340,
      dataVencimento: '2026-04-15',
      dataPagamento: '2026-04-14',
      status: 'pago',
      criadoEm: '2026-04-10T00:00:00Z',
    },
    {
      id: 'l9',
      tipo: 'recebimento',
      clienteId: 'c3',
      clienteNome: 'Maria Fernanda Costa',
      contratoId: 'ct3',
      descricao: 'Honorários êxito — Acordo judicial',
      valor: 30000,
      dataVencimento: '2026-04-20',
      dataPagamento: '2026-04-20',
      status: 'pago',
      formaPagamento: 'TED',
      criadoEm: '2026-04-15T00:00:00Z',
    },
    {
      id: 'l10',
      tipo: 'a_receber',
      clienteId: 'c2',
      clienteNome: 'Tech Solutions Ltda',
      contratoId: 'ct2',
      descricao: 'Honorários mensais — Maio/2026',
      valor: 8000,
      dataVencimento: '2026-05-10',
      status: 'pendente',
      criadoEm: '2026-05-01T00:00:00Z',
    },
  ];
  saveAll(DB_KEYS.lancamentos, lancamentos);

  // Avisos
  const avisos: Aviso[] = [
    {
      id: 'av1',
      titulo: 'Prazo de contestação vencendo',
      descricao: 'Processo 1234567-89.2024.8.26.0100 — Prazo para contestar vence em 3 dias.',
      tipo: 'prazo',
      urgencia: 'critica',
      processoId: 'p1',
      dataLimite: '2026-05-29',
      lido: false,
      criadoEm: '2026-05-24T08:00:00Z',
    },
    {
      id: 'av2',
      titulo: 'Audiência agendada',
      descricao: 'Audiência de Instrução — João Carlos Mendonça em 15/08/2026 às 14h.',
      tipo: 'audiencia',
      urgencia: 'alta',
      processoId: 'p1',
      dataLimite: '2026-08-15',
      lido: false,
      criadoEm: '2026-05-10T09:00:00Z',
    },
    {
      id: 'av3',
      titulo: 'Inadimplência — Roberto Pinheiro',
      descricao: 'Cliente Roberto Augusto Pinheiro com 2 parcelas em aberto totalizando R$ 10.000,00.',
      tipo: 'pagamento',
      urgencia: 'alta',
      clienteId: 'c5',
      lido: false,
      criadoEm: '2026-05-01T00:00:00Z',
    },
    {
      id: 'av4',
      titulo: 'Contrato suspenso — necessita revisão',
      descricao: 'Contrato de Roberto Augusto Pinheiro está suspenso — necessita revisão.',
      tipo: 'contrato',
      urgencia: 'media',
      clienteId: 'c5',
      lido: false,
      criadoEm: '2026-05-05T00:00:00Z',
    },
    {
      id: 'av5',
      titulo: 'Audiência de Conciliação',
      descricao: 'Maria Fernanda Costa — Audiência em 10/09/2026 às 10h30.',
      tipo: 'audiencia',
      urgencia: 'media',
      processoId: 'p2',
      dataLimite: '2026-09-10',
      lido: true,
      criadoEm: '2026-05-08T00:00:00Z',
    },
  ];
  saveAll(DB_KEYS.avisos, avisos);

  localStorage.setItem(DB_KEYS.initialized, 'true');
}

export { DB_KEYS };
