/**
 * Origens de Previsão de Honorários — lista persistida em localStorage.
 * O usuário pode adicionar origens customizadas e excluir as existentes.
 */

const ORIGENS_KEY = 'msk_origens_previsao';

export const DEFAULT_ORIGENS: string[] = [
  'WhatsApp',
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Indicação',
  'Site',
  'Google',
  'Anúncio',
  'Outro',
];

export function getOrigens(): string[] {
  try {
    const stored = localStorage.getItem(ORIGENS_KEY);
    return stored ? JSON.parse(stored) : [...DEFAULT_ORIGENS];
  } catch {
    return [...DEFAULT_ORIGENS];
  }
}

export function saveOrigens(list: string[]): void {
  localStorage.setItem(ORIGENS_KEY, JSON.stringify(list));
}

export function addOrigem(nome: string): boolean {
  const list = getOrigens();
  const trimmed = nome.trim();
  if (!trimmed || list.includes(trimmed)) return false;
  saveOrigens([...list, trimmed]);
  return true;
}

export function removeOrigem(nome: string): void {
  const list = getOrigens();
  saveOrigens(list.filter(o => o !== nome));
}
