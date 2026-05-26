import bcrypt from 'bcryptjs';
import { db, generateId } from './db/index';

export interface StoredUser {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'advogado' | 'assistente';
  oab?: string;
  senhaHash: string;
  ativo: boolean;
}

function rowToUser(row: Record<string, unknown>): StoredUser {
  return {
    id: row.id as string,
    nome: row.nome as string,
    email: row.email as string,
    role: row.role as 'admin' | 'advogado' | 'assistente',
    oab: (row.oab as string) ?? '',
    senhaHash: row.senhaHash as string,
    ativo: Boolean(row.ativo),
  };
}

export function findAll(): StoredUser[] {
  const rows = db.prepare('SELECT * FROM users').all() as Record<string, unknown>[];
  return rows.map(rowToUser);
}

export async function findByEmail(email: string): Promise<StoredUser | undefined> {
  const row = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : undefined;
}

export function findById(id: string): StoredUser | undefined {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : undefined;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function updatePassword(id: string, newPlain: string): Promise<boolean> {
  const senhaHash = await bcrypt.hash(newPlain, 12);
  const result = db.prepare('UPDATE users SET senhaHash = ? WHERE id = ?').run(senhaHash, id);
  return result.changes > 0;
}

export function createUser(data: { nome: string; email: string; role: 'admin' | 'advogado' | 'assistente'; oab?: string; senhaHash: string }): StoredUser {
  const id = generateId();
  const criadoEm = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, nome, email, senhaHash, role, oab, ativo, criadoEm)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, data.nome, data.email, data.senhaHash, data.role, data.oab ?? '', criadoEm);
  return findById(id)!;
}

export function updateUser(id: string, data: Partial<{ nome: string; email: string; role: string; oab: string; ativo: boolean; senhaHash: string }>): StoredUser | null {
  const existing = findById(id);
  if (!existing) return null;

  const nome     = data.nome     ?? existing.nome;
  const email    = data.email    ?? existing.email;
  const role     = data.role     ?? existing.role;
  const oab      = data.oab      ?? existing.oab ?? '';
  const ativo    = data.ativo    !== undefined ? (data.ativo ? 1 : 0) : (existing.ativo ? 1 : 0);
  const senhaHash = data.senhaHash ?? existing.senhaHash;

  db.prepare(
    `UPDATE users SET nome = ?, email = ?, role = ?, oab = ?, ativo = ?, senhaHash = ? WHERE id = ?`
  ).run(nome, email, role, oab, ativo, senhaHash, id);

  return findById(id)!;
}

export function deactivateUser(id: string): boolean {
  const result = db.prepare('UPDATE users SET ativo = 0 WHERE id = ?').run(id);
  return result.changes > 0;
}
