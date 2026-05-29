/**
 * Utilitário de prazos em dias úteis.
 *
 * Lista de feriados nacionais fixos (formato MM-DD).
 * Feriados móveis (Páscoa, Carnaval) não estão incluídos — para maior precisão,
 * inclua-os manualmente ou integre uma API.
 */
const FERIADOS_NACIONAIS = new Set([
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência do Brasil
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Dia da Consciência Negra
  '12-25', // Natal
]);

function isFeriadoOuFimDeSemana(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return true; // domingo / sábado
  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return FERIADOS_NACIONAIS.has(mmdd);
}

/**
 * Adiciona `dias` dias úteis a uma data base (formato YYYY-MM-DD).
 * Retorna a nova data no mesmo formato.
 */
export function adicionarDiasUteis(dataInicial: string, dias: number): string {
  const d = new Date(dataInicial + 'T12:00:00');
  let adicionados = 0;
  while (adicionados < dias) {
    d.setDate(d.getDate() + 1);
    if (!isFeriadoOuFimDeSemana(d)) adicionados++;
  }
  return d.toISOString().split('T')[0];
}

/**
 * Conta os dias úteis entre duas datas (inclusivo na data final).
 * Retorna 0 se dataFim <= dataInicial.
 */
export function contarDiasUteis(dataInicial: string, dataFim: string): number {
  const inicio = new Date(dataInicial + 'T12:00:00');
  const fim    = new Date(dataFim    + 'T12:00:00');
  let count = 0;
  const d = new Date(inicio);
  while (d < fim) {
    d.setDate(d.getDate() + 1);
    if (!isFeriadoOuFimDeSemana(d)) count++;
  }
  return count;
}

/**
 * Retorna a data formatada em dd/mm/aaaa.
 */
export function formatDateBR(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}
