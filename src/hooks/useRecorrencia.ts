import { useEffect } from 'react';
import { lancamentosApi } from '../services/api';
import { useToast } from '../context/ToastContext';

const FREQ_DAYS: Record<string, number> = {
  semanal:    7,
  quinzenal:  15,
  mensal:     30,
  bimestral:  60,
  trimestral: 90,
};

export function addDias(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Roda uma vez na montagem do app (após login).
 * Verifica se algum lançamento-template recorrente precisa gerar uma nova cobrança.
 * Cria a cópia (sem flag recorrente) e avança a data do próximo disparo no template.
 */
export function useRecorrencia() {
  const { showToast } = useToast();

  useEffect(() => {
    async function check() {
      const hoje = new Date().toISOString().slice(0, 10);
      let todos: Awaited<ReturnType<typeof lancamentosApi.getAll>>;
      try { todos = await lancamentosApi.getAll(); }
      catch { return; }

      const templates = todos.filter(l =>
        l.recorrente &&
        l.recorrenciaFrequencia &&
        l.status !== 'cancelado' &&
        (!l.recorrenciaProximaData || l.recorrenciaProximaData <= hoje),
      );

      if (!templates.length) return;

      let criados = 0;
      for (const tmpl of templates) {
        const dias    = FREQ_DAYS[tmpl.recorrenciaFrequencia!] ?? 30;
        const proxData = tmpl.recorrenciaProximaData || addDias(tmpl.dataVencimento, dias);
        const nextNext = addDias(proxData, dias);

        try {
          await lancamentosApi.create({
            tipo:           tmpl.tipo,
            clienteId:      tmpl.clienteId,
            clienteNome:    tmpl.clienteNome,
            descricao:      tmpl.descricao,
            valor:          tmpl.valor,
            dataVencimento: proxData,
            status:         'pendente',
            formaPagamento: tmpl.formaPagamento,
            observacoes:    tmpl.observacoes,
            jurosMensais:   tmpl.jurosMensais,
            multaPorAtraso: tmpl.multaPorAtraso,
            desconto:       tmpl.desconto,
            criadoEm:       new Date().toISOString(),
          });
          await lancamentosApi.update(tmpl.id, { recorrenciaProximaData: nextNext });
          criados++;
        } catch { /* ignora erro individual */ }
      }

      if (criados > 0) {
        showToast(
          'info',
          `${criados} cobrança${criados > 1 ? 's recorrentes geradas' : ' recorrente gerada'}`,
          'Verifique em Honorários.',
        );
      }
    }

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
