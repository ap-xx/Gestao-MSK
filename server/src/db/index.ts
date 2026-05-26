import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Em produção no Render: DATA_DIR=/opt/render/data (disco persistente montado)
// Em desenvolvimento: pasta server/data/
const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'msk.db');
const USERS_JSON = path.join(DATA_DIR, 'users.json');

// Garante que a pasta data/ existe
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);

// WAL mode para melhor performance
db.pragma('journal_mode = WAL');

// ─── Schema ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senhaHash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','advogado','assistente')),
    oab TEXT DEFAULT '',
    ativo INTEGER NOT NULL DEFAULT 1,
    criadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS escritorio (
    id TEXT PRIMARY KEY DEFAULT 'escritorio',
    dados TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    tipoPessoa TEXT NOT NULL,
    nome TEXT NOT NULL,
    cpf TEXT,
    cnpj TEXT,
    razaoSocial TEXT,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    celular TEXT,
    status TEXT NOT NULL DEFAULT 'ativo',
    observacoes TEXT,
    endereco TEXT NOT NULL DEFAULT '{}',
    porte TEXT,
    naturezaJuridica TEXT,
    capitalSocial TEXT,
    socios TEXT DEFAULT '[]',
    criadoEm TEXT NOT NULL,
    atualizadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contratos (
    id TEXT PRIMARY KEY,
    clienteId TEXT NOT NULL,
    clienteNome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    valorMensal REAL,
    percentualExito REAL,
    valorCausa REAL,
    descricao TEXT NOT NULL DEFAULT '',
    areaAtuacao TEXT NOT NULL DEFAULT '',
    dataInicio TEXT NOT NULL,
    dataFim TEXT,
    status TEXT NOT NULL DEFAULT 'ativo',
    observacoes TEXT,
    criadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processos (
    id TEXT PRIMARY KEY,
    numeroCNJ TEXT NOT NULL,
    clienteId TEXT NOT NULL,
    clienteNome TEXT NOT NULL,
    contratoId TEXT,
    tribunal TEXT NOT NULL DEFAULT '',
    tribunalAlias TEXT NOT NULL DEFAULT '',
    vara TEXT NOT NULL DEFAULT '',
    juiz TEXT,
    areaAtuacao TEXT NOT NULL DEFAULT '',
    fase TEXT NOT NULL DEFAULT 'Inicial',
    polo TEXT NOT NULL DEFAULT 'Ativo',
    parteAdversa TEXT NOT NULL DEFAULT '',
    advogadoAdverso TEXT,
    valorCausa REAL,
    audiencias TEXT NOT NULL DEFAULT '[]',
    proximaAudiencia TEXT,
    status TEXT NOT NULL DEFAULT 'ativo',
    observacoes TEXT,
    andamentos TEXT NOT NULL DEFAULT '[]',
    dadosDataJud TEXT,
    criadoEm TEXT NOT NULL,
    atualizadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lancamentos (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    clienteId TEXT,
    clienteNome TEXT,
    processoId TEXT,
    contratoId TEXT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    dataVencimento TEXT NOT NULL,
    dataPagamento TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    formaPagamento TEXT,
    observacoes TEXT,
    criadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS avisos (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    tipo TEXT NOT NULL,
    urgencia TEXT NOT NULL,
    processoId TEXT,
    clienteId TEXT,
    lancamentoId TEXT,
    dataLimite TEXT,
    lido INTEGER NOT NULL DEFAULT 0,
    criadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS google_tokens (
    userId TEXT PRIMARY KEY,
    accessToken TEXT NOT NULL DEFAULT '',
    refreshToken TEXT NOT NULL,
    expiryDate INTEGER NOT NULL DEFAULT 0,
    calendarId TEXT NOT NULL DEFAULT 'primary',
    connectedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS google_events (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    googleEventId TEXT NOT NULL,
    UNIQUE(userId, entityId)
  );
`);

// ─── Helper ────────────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Seed inicial ──────────────────────────────────────────────

const SEED_USERS = [
  { id: 'u1', nome: 'Gabriel Budal Arins',       email: 'gabrielb.arins@gmail.com',       role: 'admin',      oab: '',  senha: 'budal2005msk',  criadoEm: '2024-01-01T00:00:00Z' },
  { id: 'u2', nome: 'Miriam Kuchnier',            email: 'miriamkuchnier.adv@gmail.com',   role: 'advogado',   oab: '',  senha: 'advogada3009',   criadoEm: '2024-02-01T00:00:00Z' },
  { id: 'u3', nome: 'Andre Luiz Budal Arins',     email: 'andreluizbudalarins@gmail.com',  role: 'assistente', oab: '',  senha: 'Gorila@2020',    criadoEm: '2024-03-01T00:00:00Z' },
];

async function seedUsers(): Promise<void> {
  const count = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
  if (count > 0) return;

  // Migrar users.json se existir
  if (fs.existsSync(USERS_JSON)) {
    try {
      const fromFile: Array<{ id: string; nome: string; email: string; senhaHash: string; role: string; oab?: string }> =
        JSON.parse(fs.readFileSync(USERS_JSON, 'utf-8'));
      const insertUser = db.prepare(
        `INSERT OR IGNORE INTO users (id, nome, email, senhaHash, role, oab, ativo, criadoEm)
         VALUES (@id, @nome, @email, @senhaHash, @role, @oab, 1, @criadoEm)`
      );
      const now = new Date().toISOString();
      for (const u of fromFile) {
        insertUser.run({ ...u, oab: u.oab ?? '', criadoEm: now });
      }
      fs.unlinkSync(USERS_JSON);
      console.log('[db] Usuários migrados de users.json para SQLite. Arquivo removido.');
      return;
    } catch (err) {
      console.warn('[db] Falha ao migrar users.json:', err);
    }
  }

  // Seed fresco
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, nome, email, senhaHash, role, oab, ativo, criadoEm)
     VALUES (@id, @nome, @email, @senhaHash, @role, @oab, 1, @criadoEm)`
  );
  for (const u of SEED_USERS) {
    const senhaHash = await bcrypt.hash(u.senha, 12);
    insertUser.run({ id: u.id, nome: u.nome, email: u.email, senhaHash, role: u.role, oab: u.oab, criadoEm: u.criadoEm });
  }
  console.log('[db] Seed inicial de usuários criado com 3 usuários.');
}

function seedEscritorioIfEmpty(): void {
  const row = db.prepare("SELECT COUNT(*) as n FROM escritorio").get() as { n: number };
  if (row.n > 0) return;
  const escritorio = {
    nome: 'MSK Consultation Advocacia',
    cnpj: '12.345.678/0001-90',
    telefone: '(11) 3456-7890',
    email: 'contato@msk.adv.br',
    site: 'www.msk.adv.br',
    endereco: {
      cep: '01310-100', logradouro: 'Avenida Paulista', numero: '1000',
      complemento: 'Conj. 501', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
    },
    oabPrincipal: 'SP 123456',
    responsavel: 'Dr. Marcus Silveira Klemm',
    notificacoes: { emailAlertas: true, whatsappAlertas: true, prazosDias: 5, inadimplenciaAuto: true },
  };
  db.prepare("INSERT INTO escritorio (id, dados) VALUES ('escritorio', @dados)").run({ dados: JSON.stringify(escritorio) });
}

function seedClientesIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) as n FROM clientes').get() as { n: number }).n;
  if (count > 0) return;

  const ins = db.prepare(`INSERT OR IGNORE INTO clientes
    (id, tipoPessoa, nome, cpf, cnpj, razaoSocial, email, telefone, celular, status, observacoes,
     endereco, porte, naturezaJuridica, capitalSocial, socios, criadoEm, atualizadoEm)
    VALUES (@id, @tipoPessoa, @nome, @cpf, @cnpj, @razaoSocial, @email, @telefone, @celular, @status,
            @observacoes, @endereco, @porte, @naturezaJuridica, @capitalSocial, @socios, @criadoEm, @atualizadoEm)`);

  const clientes = [
    { id: 'c1', tipoPessoa: 'PF', nome: 'João Carlos Mendonça', cpf: '123.456.789-00', cnpj: null, razaoSocial: null,
      email: 'joao@email.com', telefone: '(11) 98765-4321', celular: null, status: 'ativo', observacoes: null,
      endereco: JSON.stringify({ cep: '01310-100', logradouro: 'Rua das Flores', numero: '123', bairro: 'Jardim Europa', cidade: 'São Paulo', uf: 'SP' }),
      porte: null, naturezaJuridica: null, capitalSocial: null, socios: '[]', criadoEm: '2024-01-15T10:00:00Z', atualizadoEm: '2024-01-15T10:00:00Z' },
    { id: 'c2', tipoPessoa: 'PJ', nome: 'Tech Solutions Ltda', cpf: null, cnpj: '23.456.789/0001-01',
      razaoSocial: 'Tech Solutions Serviços de Tecnologia Ltda', email: 'contato@techsolutions.com.br',
      telefone: '(11) 3333-4444', celular: null, status: 'ativo', observacoes: null,
      endereco: JSON.stringify({ cep: '04538-133', logradouro: 'Rua Joaquim Floriano', numero: '100', complemento: 'CJ 301', bairro: 'Itaim Bibi', cidade: 'São Paulo', uf: 'SP' }),
      porte: 'MEDIO', naturezaJuridica: 'Sociedade Empresária Limitada', capitalSocial: 'R$ 500.000,00', socios: '[]', criadoEm: '2024-02-10T14:00:00Z', atualizadoEm: '2024-02-10T14:00:00Z' },
    { id: 'c3', tipoPessoa: 'PF', nome: 'Maria Fernanda Costa', cpf: '987.654.321-00', cnpj: null, razaoSocial: null,
      email: 'maria@email.com', telefone: '(21) 99876-5432', celular: null, status: 'ativo', observacoes: null,
      endereco: JSON.stringify({ cep: '22041-001', logradouro: 'Av. Atlântica', numero: '500', bairro: 'Copacabana', cidade: 'Rio de Janeiro', uf: 'RJ' }),
      porte: null, naturezaJuridica: null, capitalSocial: null, socios: '[]', criadoEm: '2024-03-05T09:00:00Z', atualizadoEm: '2024-03-05T09:00:00Z' },
    { id: 'c4', tipoPessoa: 'PJ', nome: 'Construtora Vale Verde S/A', cpf: null, cnpj: '34.567.890/0001-12',
      razaoSocial: 'Construtora Vale Verde S/A', email: 'juridico@valeverde.com.br',
      telefone: '(11) 4444-5555', celular: null, status: 'ativo', observacoes: null,
      endereco: JSON.stringify({ cep: '01402-001', logradouro: 'Alameda Santos', numero: '2000', bairro: 'Cerqueira César', cidade: 'São Paulo', uf: 'SP' }),
      porte: 'GRANDE', naturezaJuridica: 'Sociedade Anônima Fechada', capitalSocial: 'R$ 10.000.000,00', socios: '[]', criadoEm: '2024-01-20T11:00:00Z', atualizadoEm: '2024-01-20T11:00:00Z' },
    { id: 'c5', tipoPessoa: 'PF', nome: 'Roberto Augusto Pinheiro', cpf: '456.789.123-00', cnpj: null, razaoSocial: null,
      email: 'roberto@email.com', telefone: '(31) 97654-3210', celular: null, status: 'bloqueado', observacoes: null,
      endereco: JSON.stringify({ cep: '30130-110', logradouro: 'Rua da Bahia', numero: '75', bairro: 'Centro', cidade: 'Belo Horizonte', uf: 'MG' }),
      porte: null, naturezaJuridica: null, capitalSocial: null, socios: '[]', criadoEm: '2024-04-01T08:00:00Z', atualizadoEm: '2024-04-01T08:00:00Z' },
  ];

  for (const c of clientes) ins.run(c);
  console.log('[db] Seed de clientes criado.');
}

function seedContratosIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) as n FROM contratos').get() as { n: number }).n;
  if (count > 0) return;

  const ins = db.prepare(`INSERT OR IGNORE INTO contratos
    (id, clienteId, clienteNome, tipo, valorMensal, percentualExito, valorCausa, descricao, areaAtuacao, dataInicio, dataFim, status, observacoes, criadoEm)
    VALUES (@id, @clienteId, @clienteNome, @tipo, @valorMensal, @percentualExito, @valorCausa, @descricao, @areaAtuacao, @dataInicio, @dataFim, @status, @observacoes, @criadoEm)`);

  const contratos = [
    { id: 'ct1', clienteId: 'c1', clienteNome: 'João Carlos Mendonça', tipo: 'Mensal', valorMensal: 3500, percentualExito: null, valorCausa: null, descricao: 'Assessoria jurídica trabalhista', areaAtuacao: 'Trabalhista', dataInicio: '2024-01-15', dataFim: null, status: 'ativo', observacoes: null, criadoEm: '2024-01-15T10:00:00Z' },
    { id: 'ct2', clienteId: 'c2', clienteNome: 'Tech Solutions Ltda', tipo: 'Mensal', valorMensal: 8000, percentualExito: null, valorCausa: null, descricao: 'Consultoria jurídica empresarial e contratos', areaAtuacao: 'Empresarial', dataInicio: '2024-02-10', dataFim: null, status: 'ativo', observacoes: null, criadoEm: '2024-02-10T14:00:00Z' },
    { id: 'ct3', clienteId: 'c3', clienteNome: 'Maria Fernanda Costa', tipo: 'Êxito', valorMensal: null, percentualExito: 20, valorCausa: 150000, descricao: 'Ação de danos morais — acidente de trânsito', areaAtuacao: 'Cível', dataInicio: '2024-03-05', dataFim: null, status: 'ativo', observacoes: null, criadoEm: '2024-03-05T09:00:00Z' },
    { id: 'ct4', clienteId: 'c4', clienteNome: 'Construtora Vale Verde S/A', tipo: 'Misto', valorMensal: 15000, percentualExito: 10, valorCausa: 2000000, descricao: 'Assessoria jurídica + litígios imobiliários', areaAtuacao: 'Imobiliário', dataInicio: '2024-01-20', dataFim: null, status: 'ativo', observacoes: null, criadoEm: '2024-01-20T11:00:00Z' },
    { id: 'ct5', clienteId: 'c5', clienteNome: 'Roberto Augusto Pinheiro', tipo: 'Avulso', valorMensal: null, percentualExito: null, valorCausa: null, descricao: 'Ação de inventário', areaAtuacao: 'Família e Sucessões', dataInicio: '2024-04-01', dataFim: null, status: 'suspenso', observacoes: null, criadoEm: '2024-04-01T08:00:00Z' },
  ];

  for (const c of contratos) ins.run(c);
  console.log('[db] Seed de contratos criado.');
}

function seedProcessosIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) as n FROM processos').get() as { n: number }).n;
  if (count > 0) return;

  const ins = db.prepare(`INSERT OR IGNORE INTO processos
    (id, numeroCNJ, clienteId, clienteNome, contratoId, tribunal, tribunalAlias, vara, juiz, areaAtuacao,
     fase, polo, parteAdversa, advogadoAdverso, valorCausa, audiencias, proximaAudiencia, status, observacoes,
     andamentos, dadosDataJud, criadoEm, atualizadoEm)
    VALUES (@id, @numeroCNJ, @clienteId, @clienteNome, @contratoId, @tribunal, @tribunalAlias, @vara, @juiz,
            @areaAtuacao, @fase, @polo, @parteAdversa, @advogadoAdverso, @valorCausa, @audiencias,
            @proximaAudiencia, @status, @observacoes, @andamentos, @dadosDataJud, @criadoEm, @atualizadoEm)`);

  const processos = [
    {
      id: 'p1', numeroCNJ: '1234567-89.2024.8.26.0100', clienteId: 'c1', clienteNome: 'João Carlos Mendonça',
      contratoId: 'ct1', tribunal: 'Tribunal de Justiça de São Paulo', tribunalAlias: 'tjsp',
      vara: '5ª Vara do Trabalho de São Paulo', juiz: null, areaAtuacao: 'Trabalhista',
      fase: 'Instrução', polo: 'Ativo', parteAdversa: 'Empresa XYZ Comércio Ltda', advogadoAdverso: 'Dr. Carlos Pinto',
      valorCausa: 45000,
      audiencias: JSON.stringify([{ data: '2026-08-15', hora: '14:00', tipo: 'Audiência de Instrução', local: 'Fórum Trabalhista de SP', vara: '5ª VT' }]),
      proximaAudiencia: '2026-08-15', status: 'ativo', observacoes: null, andamentos: '[]', dadosDataJud: null,
      criadoEm: '2024-01-15T10:00:00Z', atualizadoEm: '2026-05-01T00:00:00Z',
    },
    {
      id: 'p2', numeroCNJ: '9876543-21.2024.8.26.0100', clienteId: 'c3', clienteNome: 'Maria Fernanda Costa',
      contratoId: 'ct3', tribunal: 'Tribunal de Justiça do Rio de Janeiro', tribunalAlias: 'tjrj',
      vara: '3ª Vara Cível da Comarca do Rio de Janeiro', juiz: null, areaAtuacao: 'Cível',
      fase: 'Conhecimento', polo: 'Ativo', parteAdversa: 'Seguradora Nacional S/A', advogadoAdverso: null,
      valorCausa: 150000,
      audiencias: JSON.stringify([{ data: '2026-09-10', hora: '10:30', tipo: 'Audiência de Conciliação', local: 'Fórum Central RJ' }]),
      proximaAudiencia: '2026-09-10', status: 'ativo', observacoes: null, andamentos: '[]', dadosDataJud: null,
      criadoEm: '2024-03-05T09:00:00Z', atualizadoEm: '2026-04-20T00:00:00Z',
    },
    {
      id: 'p3', numeroCNJ: '5555555-55.2023.8.26.0100', clienteId: 'c4', clienteNome: 'Construtora Vale Verde S/A',
      contratoId: 'ct4', tribunal: 'Tribunal de Justiça de São Paulo', tribunalAlias: 'tjsp',
      vara: '1ª Vara de Falências e Recuperações Judiciais', juiz: null, areaAtuacao: 'Imobiliário',
      fase: 'Recursal', polo: 'Passivo', parteAdversa: 'Condomínio Residencial Park Hills', advogadoAdverso: null,
      valorCausa: 2000000, audiencias: '[]', proximaAudiencia: null, status: 'ativo', observacoes: null,
      andamentos: '[]', dadosDataJud: null, criadoEm: '2024-01-20T11:00:00Z', atualizadoEm: '2026-05-05T00:00:00Z',
    },
  ];

  for (const p of processos) ins.run(p);
  console.log('[db] Seed de processos criado.');
}

function seedLancamentosIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) as n FROM lancamentos').get() as { n: number }).n;
  if (count > 0) return;

  const ins = db.prepare(`INSERT OR IGNORE INTO lancamentos
    (id, tipo, clienteId, clienteNome, processoId, contratoId, descricao, valor, dataVencimento, dataPagamento, status, formaPagamento, observacoes, criadoEm)
    VALUES (@id, @tipo, @clienteId, @clienteNome, @processoId, @contratoId, @descricao, @valor, @dataVencimento, @dataPagamento, @status, @formaPagamento, @observacoes, @criadoEm)`);

  const lancamentos = [
    { id: 'l1',  tipo: 'recebimento', clienteId: 'c1', clienteNome: 'João Carlos Mendonça',     processoId: null, contratoId: 'ct1', descricao: 'Honorários mensais — Abril/2026',     valor: 3500,  dataVencimento: '2026-04-05', dataPagamento: '2026-04-04', status: 'pago',    formaPagamento: 'PIX', observacoes: null, criadoEm: '2026-04-01T00:00:00Z' },
    { id: 'l2',  tipo: 'recebimento', clienteId: 'c2', clienteNome: 'Tech Solutions Ltda',       processoId: null, contratoId: 'ct2', descricao: 'Honorários mensais — Abril/2026',     valor: 8000,  dataVencimento: '2026-04-10', dataPagamento: '2026-04-09', status: 'pago',    formaPagamento: 'TED', observacoes: null, criadoEm: '2026-04-01T00:00:00Z' },
    { id: 'l3',  tipo: 'a_receber',   clienteId: 'c4', clienteNome: 'Construtora Vale Verde S/A', processoId: null, contratoId: 'ct4', descricao: 'Honorários mensais — Maio/2026',     valor: 15000, dataVencimento: '2026-05-10', dataPagamento: null,         status: 'pendente', formaPagamento: null,  observacoes: null, criadoEm: '2026-05-01T00:00:00Z' },
    { id: 'l4',  tipo: 'recebimento', clienteId: 'c1', clienteNome: 'João Carlos Mendonça',     processoId: null, contratoId: 'ct1', descricao: 'Honorários mensais — Maio/2026',      valor: 3500,  dataVencimento: '2026-05-05', dataPagamento: '2026-05-05', status: 'pago',    formaPagamento: 'PIX', observacoes: null, criadoEm: '2026-05-01T00:00:00Z' },
    { id: 'l5',  tipo: 'a_receber',   clienteId: 'c5', clienteNome: 'Roberto Augusto Pinheiro', processoId: null, contratoId: null,  descricao: 'Parcela 1/3 — Ação de Inventário',  valor: 5000,  dataVencimento: '2026-02-01', dataPagamento: null,         status: 'vencido',  formaPagamento: null,  observacoes: null, criadoEm: '2026-01-15T00:00:00Z' },
    { id: 'l6',  tipo: 'a_receber',   clienteId: 'c5', clienteNome: 'Roberto Augusto Pinheiro', processoId: null, contratoId: null,  descricao: 'Parcela 2/3 — Ação de Inventário',  valor: 5000,  dataVencimento: '2026-03-01', dataPagamento: null,         status: 'vencido',  formaPagamento: null,  observacoes: null, criadoEm: '2026-01-15T00:00:00Z' },
    { id: 'l7',  tipo: 'despesa',     clienteId: null, clienteNome: null,                        processoId: null, contratoId: null,  descricao: 'Aluguel do escritório — Maio/2026',  valor: 8500,  dataVencimento: '2026-05-05', dataPagamento: null,         status: 'pendente', formaPagamento: null,  observacoes: null, criadoEm: '2026-05-01T00:00:00Z' },
    { id: 'l8',  tipo: 'despesa',     clienteId: null, clienteNome: null,                        processoId: null, contratoId: null,  descricao: 'Custas processuais — Processo Construtora', valor: 2340, dataVencimento: '2026-04-15', dataPagamento: '2026-04-14', status: 'pago', formaPagamento: null, observacoes: null, criadoEm: '2026-04-10T00:00:00Z' },
    { id: 'l9',  tipo: 'recebimento', clienteId: 'c3', clienteNome: 'Maria Fernanda Costa',     processoId: null, contratoId: 'ct3', descricao: 'Honorários êxito — Acordo judicial', valor: 30000, dataVencimento: '2026-04-20', dataPagamento: '2026-04-20', status: 'pago',    formaPagamento: 'TED', observacoes: null, criadoEm: '2026-04-15T00:00:00Z' },
    { id: 'l10', tipo: 'a_receber',   clienteId: 'c2', clienteNome: 'Tech Solutions Ltda',       processoId: null, contratoId: 'ct2', descricao: 'Honorários mensais — Maio/2026',     valor: 8000,  dataVencimento: '2026-05-10', dataPagamento: null,         status: 'pendente', formaPagamento: null,  observacoes: null, criadoEm: '2026-05-01T00:00:00Z' },
  ];

  for (const l of lancamentos) ins.run(l);
  console.log('[db] Seed de lançamentos criado.');
}

function seedAvisosIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) as n FROM avisos').get() as { n: number }).n;
  if (count > 0) return;

  const ins = db.prepare(`INSERT OR IGNORE INTO avisos
    (id, titulo, descricao, tipo, urgencia, processoId, clienteId, lancamentoId, dataLimite, lido, criadoEm)
    VALUES (@id, @titulo, @descricao, @tipo, @urgencia, @processoId, @clienteId, @lancamentoId, @dataLimite, @lido, @criadoEm)`);

  const avisos = [
    { id: 'av1', titulo: 'Prazo de contestação vencendo', descricao: 'Processo 1234567-89.2024.8.26.0100 — Prazo para contestar vence em 3 dias.', tipo: 'prazo', urgencia: 'critica', processoId: 'p1', clienteId: null, lancamentoId: null, dataLimite: '2026-05-29', lido: 0, criadoEm: '2026-05-24T08:00:00Z' },
    { id: 'av2', titulo: 'Audiência agendada', descricao: 'Audiência de Instrução — João Carlos Mendonça em 15/08/2026 às 14h.', tipo: 'audiencia', urgencia: 'alta', processoId: 'p1', clienteId: null, lancamentoId: null, dataLimite: '2026-08-15', lido: 0, criadoEm: '2026-05-10T09:00:00Z' },
    { id: 'av3', titulo: 'Inadimplência — Roberto Pinheiro', descricao: 'Cliente Roberto Augusto Pinheiro com 2 parcelas em aberto totalizando R$ 10.000,00.', tipo: 'pagamento', urgencia: 'alta', processoId: null, clienteId: 'c5', lancamentoId: null, dataLimite: null, lido: 0, criadoEm: '2026-05-01T00:00:00Z' },
    { id: 'av4', titulo: 'Contrato suspenso — necessita revisão', descricao: 'Contrato de Roberto Augusto Pinheiro está suspenso — necessita revisão.', tipo: 'contrato', urgencia: 'media', processoId: null, clienteId: 'c5', lancamentoId: null, dataLimite: null, lido: 0, criadoEm: '2026-05-05T00:00:00Z' },
    { id: 'av5', titulo: 'Audiência de Conciliação', descricao: 'Maria Fernanda Costa — Audiência em 10/09/2026 às 10h30.', tipo: 'audiencia', urgencia: 'media', processoId: 'p2', clienteId: null, lancamentoId: null, dataLimite: '2026-09-10', lido: 1, criadoEm: '2026-05-08T00:00:00Z' },
  ];

  for (const a of avisos) ins.run(a);
  console.log('[db] Seed de avisos criado.');
}

// ─── Função principal exportada ────────────────────────────────

export async function initializeDatabase(): Promise<void> {
  await seedUsers();
  seedEscritorioIfEmpty();
  // Dados de exemplo removidos — cadastro manual via interface
  console.log('[db] Banco de dados inicializado em', DB_PATH);
}
