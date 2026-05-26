import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');

export interface StoredUser {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'advogado' | 'assistente';
  oab?: string;
  senhaHash: string;
}

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

const SEED_USERS: Array<Omit<StoredUser, 'senhaHash'> & { senha: string }> = [
  {
    id: 'u1',
    nome: 'Gabriel Budal Arins',
    email: 'gabrielb.arins@gmail.com',
    role: 'admin',
    senha: 'budal2005msk',
  },
  {
    id: 'u2',
    nome: 'Miriam Kuchnier',
    email: 'miriamkuchnier.adv@gmail.com',
    role: 'advogado',
    oab: '',
    senha: 'advogada3009',
  },
  {
    id: 'u3',
    nome: 'Andre Luiz Budal Arins',
    email: 'andreluizbudalarins@gmail.com',
    role: 'assistente',
    senha: 'Gorila@2020',
  },
];

export async function seedUsersIfEmpty(): Promise<void> {
  const existing = readUsers();
  if (existing.length > 0) return;

  const hashed: StoredUser[] = await Promise.all(
    SEED_USERS.map(async ({ senha, ...rest }) => ({
      ...rest,
      senhaHash: await bcrypt.hash(senha, 12),
    }))
  );
  writeUsers(hashed);
  console.log('[users] Seed inicial criado com 3 usuarios.');
}

export async function findByEmail(email: string): Promise<StoredUser | undefined> {
  return readUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function updatePassword(id: string, newPlain: string): Promise<boolean> {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  users[idx].senhaHash = await bcrypt.hash(newPlain, 12);
  writeUsers(users);
  return true;
}
