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

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userNome TEXT NOT NULL,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    entidadeId TEXT,
    detalhe TEXT,
    ip TEXT,
    criadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documentos (
    id TEXT PRIMARY KEY,
    entidade TEXT NOT NULL,
    entidadeId TEXT NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    tamanho INTEGER NOT NULL DEFAULT 0,
    conteudo TEXT NOT NULL,
    criadoEm TEXT NOT NULL,
    criadoPor TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiresAt TEXT NOT NULL,
    criadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS perfis (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT DEFAULT '',
    modulos TEXT NOT NULL DEFAULT '["dashboard","clientes","contratos","processos","honorarios","agenda","inadimplencia","avisos"]',
    criadoEm TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS machine_reports (
    machineId   TEXT PRIMARY KEY,
    machineName TEXT NOT NULL DEFAULT '',
    licenseKey  TEXT NOT NULL,
    activatedAt TEXT,
    lastLogin   TEXT,
    loginCount  INTEGER NOT NULL DEFAULT 0,
    dbSizeKb    INTEGER NOT NULL DEFAULT 0,
    cidade      TEXT,
    uf          TEXT,
    ip          TEXT,
    reportedAt  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS license_keys (
    id          TEXT PRIMARY KEY,
    key         TEXT UNIQUE NOT NULL,
    descricao   TEXT DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
    criadoPor   TEXT NOT NULL DEFAULT 'admin',
    criadoEm    TEXT NOT NULL,
    atualizadoEm TEXT NOT NULL
  );
`);

// ─── Migrações não-destrutivas ─────────────────────────────────
// Adiciona colunas novas em tabelas existentes sem recriar o schema
const migrations: Array<[string, string]> = [
  ['clientes',    'ALTER TABLE clientes ADD COLUMN avaliacao INTEGER DEFAULT 0'],
  ['documentos',  'ALTER TABLE documentos ADD COLUMN categoria TEXT DEFAULT "outros"'],
  ['users',       'ALTER TABLE users ADD COLUMN perfilId TEXT'],
];
for (const [, sql] of migrations) {
  try { db.exec(sql); } catch { /* coluna já existe — ignora */ }
}

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
    nome: 'MSK Gestor',
    cnpj: '', telefone: '', email: '', site: '',
    endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
    oabPrincipal: '', responsavel: '',
    notificacoes: { emailAlertas: true, whatsappAlertas: true, prazosDias: 5, inadimplenciaAuto: true },
  };
  db.prepare("INSERT INTO escritorio (id, dados) VALUES ('escritorio', @dados)").run({ dados: JSON.stringify(escritorio) });
}

// ─── Limpeza de dados de exemplo ──────────────────────────────
// Remove entradas inseridas pelo seed inicial caso ainda existam no banco.

function purgeSeedData(): void {
  // Deleta um ID por vez — evita spread variádico que pode falhar em runtime
  const toDelete: Array<[string, string[]]> = [
    ['clientes',    ['c1','c2','c3','c4','c5']],
    ['contratos',   ['ct1','ct2','ct3','ct4','ct5']],
    ['processos',   ['p1','p2','p3']],
    ['lancamentos', ['l1','l2','l3','l4','l5','l6','l7','l8','l9','l10']],
    ['avisos',      ['av1','av2','av3','av4','av5']],
  ];

  for (const [table, ids] of toDelete) {
    const stmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
    for (const id of ids) {
      stmt.run(id);
    }
  }

  // Resetar escritório se ainda tem o CNPJ falso do seed
  const esc = db.prepare("SELECT dados FROM escritorio WHERE id = 'escritorio'").get() as { dados: string } | undefined;
  if (esc) {
    try {
      const dados = JSON.parse(esc.dados);
      if (dados.cnpj === '12.345.678/0001-90') {
        const fresh = {
          nome: 'MSK Gestor',
          cnpj: '', telefone: '', email: '', site: '',
          endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
          oabPrincipal: '', responsavel: '',
          notificacoes: { emailAlertas: true, whatsappAlertas: true, prazosDias: 5, inadimplenciaAuto: true },
        };
        db.prepare("UPDATE escritorio SET dados = ? WHERE id = 'escritorio'").run(JSON.stringify(fresh));
      }
    } catch { /* JSON inválido — ignora */ }
  }
}

// ─── Função principal exportada ────────────────────────────────

export async function initializeDatabase(): Promise<void> {
  await seedUsers();
  seedEscritorioIfEmpty();
  try { purgeSeedData(); } catch (e) { console.warn('[db] purgeSeedData não crítico:', e); }
  console.log('[db] Banco de dados inicializado em', DB_PATH);
}
