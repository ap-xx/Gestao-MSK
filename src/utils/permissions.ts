import type { UserRole } from '../types';

/** Pages accessible to the assistente role */
export const ASSISTENTE_PAGES = new Set([
  'dashboard', 'clientes', 'processos', 'contratos', 'agenda', 'avisos',
]);
// previsao, honorarios, inadimplencia, relatorios, documentos, configuracoes, licencas
// are NOT in ASSISTENTE_PAGES → assistente is redirected to dashboard

/**
 * Returns true when the given role may navigate to the given page key.
 * admin    → all pages
 * advogado → all pages except 'licencas'
 * assistente → only ASSISTENTE_PAGES (read-only views)
 */
export function canAccessPage(role: UserRole | undefined, page: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (role === 'advogado') return page !== 'licencas';
  if (role === 'assistente') return ASSISTENTE_PAGES.has(page);
  return false;
}

/**
 * Returns true when the role is allowed to create / edit / delete records.
 * admin and advogado can write; assistente is read-only.
 */
export function canWrite(role: UserRole | undefined): boolean {
  return role === 'admin' || role === 'advogado';
}

/**
 * Returns true only for admin — the only role allowed to wipe the database.
 */
export function canZerarBanco(role: UserRole | undefined): boolean {
  return role === 'admin';
}

/**
 * Returns true when the role may view a given Configurações tab.
 * admin       → all tabs
 * advogado    → all tabs except 'usuarios' and 'permissoes'
 * assistente  → no tabs (cannot access Configurações at all)
 */
export function canAccessConfigTab(role: UserRole | undefined, tab: string): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  if (role === 'advogado') return !['usuarios', 'permissoes'].includes(tab);
  return false; // assistente
}
