/**
 * IndexedDB database layer — replaces localStorage for business data.
 *
 * Why IndexedDB?
 *   • localStorage has a hard limit of ~5 MB per origin.
 *   • IndexedDB supports gigabytes (limited only by available disk space).
 *   • Queries are indexed and faster for large datasets.
 *
 * Migration:
 *   On first run after this change, `migrateFromLocalStorage()` is called
 *   automatically. It reads every key from localStorage and writes the data
 *   to IndexedDB, then sets a migration flag so it never runs again.
 *
 * Non-migrated keys (stay in localStorage):
 *   Users, session, license, escritório config — small, security-critical.
 */

import Dexie, { type Table } from 'dexie';
import type {
  Cliente, Contrato, Processo, Lancamento, Aviso,
} from '../types';
import type { PrevisaoHonorario } from '../types';

const MIGRATION_FLAG = 'msk_idb_migrated_v1';

// ─── Schema ────────────────────────────────────────────────────

export class MSKDatabase extends Dexie {
  clientes!:    Table<Cliente>;
  contratos!:   Table<Contrato>;
  processos!:   Table<Processo>;
  lancamentos!: Table<Lancamento>;
  avisos!:      Table<Aviso>;
  previsoes!:   Table<PrevisaoHonorario>;

  constructor() {
    super('MSKGestor');
    this.version(1).stores({
      // Only indexed fields go here; all other fields are stored automatically.
      clientes:    'id, tipoPessoa, nome, status, criadoEm',
      contratos:   'id, clienteId, tipo, status, criadoEm',
      processos:   'id, clienteId, numeroCNJ, status, criadoEm',
      lancamentos: 'id, clienteId, contratoId, tipo, status, dataVencimento',
      avisos:      'id, tipo, urgencia, lido, criadoEm',
      previsoes:   'id, tipoPessoa, status, criadoEm',
    });
  }
}

export const idb = new MSKDatabase();

// ─── CRUD helpers (replicate the synchronous API surface, now async) ──────

function makeStore<T extends { id: string }>(table: Table<T>) {
  return {
    getAll:       ():                Promise<T[]>          => table.toArray(),
    getById:      (id: string):      Promise<T | undefined> => table.get(id),
    getByField:   (field: keyof T, value: unknown): Promise<T[]> =>
      table.where(field as string).equals(value as string).toArray(),
    insert:       (item: T):         Promise<T>            =>
      table.add(item).then(() => item),
    insertBulk:   (items: T[]):      Promise<void>         =>
      table.bulkPut(items).then(() => undefined),
    update:       (id: string, u: Partial<T>): Promise<T | null> =>
      table.get(id).then(existing => {
        if (!existing) return null;
        const merged = { ...existing, ...u };
        return table.put(merged).then(() => merged);
      }),
    remove:       (id: string):      Promise<boolean>      =>
      table.delete(id).then(() => true),
    clear:        ():                Promise<void>         =>
      table.clear(),
    count:        ():                Promise<number>       =>
      table.count(),
  };
}

export const IDBClientes    = makeStore(idb.clientes);
export const IDBContratos   = makeStore(idb.contratos);
export const IDBProcessos   = makeStore(idb.processos);
export const IDBLancamentos = makeStore(idb.lancamentos);
export const IDBAviso       = makeStore(idb.avisos);
export const IDBPrevisoes   = makeStore(idb.previsoes);

// ─── Migration from localStorage ─────────────────────────────

function readLS<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch { return []; }
}

export async function migrateFromLocalStorage(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) return; // already done

  console.log('[idb] Migrating data from localStorage to IndexedDB…');

  await Promise.all([
    idb.clientes.count().then(async n => {
      if (n === 0) {
        const data = readLS<Cliente>('msk_clientes');
        if (data.length) await idb.clientes.bulkPut(data);
      }
    }),
    idb.contratos.count().then(async n => {
      if (n === 0) {
        const data = readLS<Contrato>('msk_contratos');
        if (data.length) await idb.contratos.bulkPut(data);
      }
    }),
    idb.processos.count().then(async n => {
      if (n === 0) {
        const data = readLS<Processo>('msk_processos');
        if (data.length) await idb.processos.bulkPut(data);
      }
    }),
    idb.lancamentos.count().then(async n => {
      if (n === 0) {
        const data = readLS<Lancamento>('msk_lancamentos');
        if (data.length) await idb.lancamentos.bulkPut(data);
      }
    }),
    idb.avisos.count().then(async n => {
      if (n === 0) {
        const data = readLS<Aviso>('msk_avisos');
        if (data.length) await idb.avisos.bulkPut(data);
      }
    }),
    idb.previsoes.count().then(async n => {
      if (n === 0) {
        const data = readLS<PrevisaoHonorario>('msk_previsoes');
        if (data.length) await idb.previsoes.bulkPut(data);
      }
    }),
  ]);

  localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  console.log('[idb] Migration complete.');
}
