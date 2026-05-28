import type { Lancamento, Escritorio, Cliente, Processo, Contrato } from '../types';

// ── Helpers ──────────────────────────────────────────────────────
function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');
}
function h(s: string | number) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; line-height: 1.55; color: #1a1a1a; background: #fff; padding: 40px 48px; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #e5e5e5; margin-bottom: 24px; }
  .doc-header h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; color: #111; }
  .doc-header p  { font-size: 11px; color: #666; margin-top: 3px; }
  .doc-header-right { text-align: right; }
  .doc-header-right .title { font-size: 14px; font-weight: 600; color: #333; }
  .doc-header-right .sub   { font-size: 11px; color: #888; margin-top: 3px; }
  h2 { font-size: 12px; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid #e5e5e5; padding-bottom: 7px; margin: 24px 0 12px; }
  h2:first-of-type { margin-top: 0; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi { border: 1px solid #e5e5e5; border-radius: 8px; padding: 11px 14px; }
  .kpi-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-value { font-size: 20px; font-weight: 700; margin-top: 3px; }
  .kpi-sub   { font-size: 10px; color: #aaa; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #f5f5f5; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; padding: 8px 10px; text-align: left; border: 1px solid #e5e5e5; }
  td { padding: 7px 10px; border: 1px solid #eee; font-size: 11px; color: #333; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafafa; }
  td.r { text-align: right; }
  .tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 500; }
  .tag-pago     { background: #dcfce7; color: #166534; }
  .tag-pendente { background: #fef9c3; color: #854d0e; }
  .tag-vencido  { background: #fee2e2; color: #991b1b; }
  .tag-ativo    { background: #dbeafe; color: #1e40af; }
  .tag-suspenso { background: #fef3c7; color: #92400e; }
  .tag-encerrado{ background: #f3f4f6; color: #374151; }
  .tag-arquivado{ background: #f3f4f6; color: #6b7280; }
  .c-green { color: #16a34a; } .c-amber { color: #b45309; } .c-red { color: #dc2626; }
  .c-blue  { color: #1d4ed8; } .c-gray  { color: #6b7280; }
  .bar-wrap { height: 6px; background: #e5e5e5; border-radius: 3px; overflow: hidden; margin-top: 3px; }
  .bar      { height: 100%; border-radius: 3px; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e8e8e8; text-align: center; font-size: 10px; color: #bbb; }
  @media print { body { padding: 0; } @page { margin: 1.5cm; size: A4; } }
`;

function openAndPrint(title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html><html lang="pt-BR">
<head><meta charset="UTF-8"><title>${h(title)}</title>
<style>${BASE_CSS}</style></head>
<body>${bodyHtml}
<div class="footer">MSK Gestor · ${new Date().toLocaleDateString('pt-BR')}</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=920,height=1040,scrollbars=yes');
  if (!win) { alert('Popups bloqueados pelo navegador.\nPermita popups para este site e tente novamente.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.addEventListener('afterprint', () => win.close());
    setTimeout(() => { try { win.close(); } catch {} }, 60_000);
  }, 600);
}

// ════════════════════════════════════════════════════════════════
// HONORÁRIOS — tabela de lançamentos
// ════════════════════════════════════════════════════════════════
export function printHonorarios(opts: {
  items: Lancamento[];
  tabLabel: string;
  stats: { recebido: number; aReceber: number; despesas: number };
  escritorio: Escritorio | null;
}) {
  const { items, tabLabel, stats, escritorio: e } = opts;
  const saldo = stats.recebido - stats.despesas;

  const officeHeader = `
  <div class="doc-header">
    <div>
      <h1>${h(e?.nome || 'MSK Gestor')}</h1>
      ${e?.cnpj         ? `<p>CNPJ: ${h(e.cnpj)}</p>` : ''}
      ${e?.oabPrincipal ? `<p>OAB: ${h(e.oabPrincipal)}</p>` : ''}
    </div>
    <div class="doc-header-right">
      <div class="title">Honorários — ${h(tabLabel)}</div>
      <div class="sub">${items.length} registro${items.length !== 1 ? 's' : ''} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>`;

  const kpis = `
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Recebido</div>  <div class="kpi-value c-green">${fmt(stats.recebido)}</div></div>
    <div class="kpi"><div class="kpi-label">A Receber</div>  <div class="kpi-value c-amber">${fmt(stats.aReceber)}</div></div>
    <div class="kpi"><div class="kpi-label">Despesas</div>   <div class="kpi-value c-red">${fmt(stats.despesas)}</div></div>
    <div class="kpi"><div class="kpi-label">Saldo Líquido</div><div class="kpi-value ${saldo >= 0 ? 'c-green' : 'c-red'}">${fmt(saldo)}</div></div>
  </div>`;

  const rows = items.map(l => `
  <tr>
    <td>${h(l.descricao)}</td>
    <td>${h(l.clienteNome || '—')}</td>
    <td>${fmtDate(l.dataVencimento)}</td>
    <td class="r">${fmt(l.valor)}</td>
    <td><span class="tag tag-${l.status}">${l.status === 'pago' ? 'Pago' : l.status === 'pendente' ? 'Pendente' : l.status === 'vencido' ? 'Vencido' : h(l.status)}</span></td>
    <td>${h(l.formaPagamento || '—')}</td>
  </tr>`).join('');

  const table = `
  <h2>Lançamentos</h2>
  <table>
    <thead><tr>
      <th>Descrição</th><th>Cliente</th><th>Vencimento</th>
      <th>Valor</th><th>Status</th><th>Forma de pagamento</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:16px">Sem registros</td></tr>'}</tbody>
  </table>`;

  openAndPrint(`Honorários — ${tabLabel}`, officeHeader + kpis + table);
}

// ════════════════════════════════════════════════════════════════
// RELATÓRIOS — dashboard completo ou seção específica
// ════════════════════════════════════════════════════════════════

export interface RelatorioData {
  periodoLabel: string;
  clientes:        Cliente[];
  processos:       Processo[];
  contratos:       Contrato[];
  fin: {
    totalRecebido: number; totalDespesas: number;
    totalAReceber: number; totalVencido:  number;
    vencidos: Lancamento[];
  };
  mesesData: Array<{ label: string; recebido: number; despesas: number }>;
  porArea:    Array<[string, number]>;
  porStatus:  Record<string, number>;
  topInadimplentes: Array<{ nome: string; total: number }>;
  topClientes: Cliente[];
  escritorio?: Escritorio | null;
}

// Gerador por seção — retorna string HTML ou '' se não aplicável
function secaoKpis(d: RelatorioData): string {
  const ativos = d.clientes.filter(c => c.status === 'ativo').length;
  return `
  <h2>Visão Geral</h2>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Clientes ativos</div>
      <div class="kpi-value c-amber">${ativos}</div>
      <div class="kpi-sub">${d.clientes.length} total</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Processos ativos</div>
      <div class="kpi-value c-blue">${d.porStatus.ativo || 0}</div>
      <div class="kpi-sub">${d.processos.length} total</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Contratos ativos</div>
      <div class="kpi-value" style="color:#7c3aed">${d.contratos.filter(c => c.status === 'ativo').length}</div>
      <div class="kpi-sub">${d.contratos.length} total</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Inadimplentes</div>
      <div class="kpi-value c-red">${d.fin.vencidos.length}</div>
      <div class="kpi-sub">${fmt(d.fin.totalVencido)}</div>
    </div>
  </div>`;
}

function secaoFinanceiro(d: RelatorioData): string {
  const saldo = d.fin.totalRecebido - d.fin.totalDespesas;
  return `
  <h2>Financeiro — ${h(d.periodoLabel)}</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Recebido</div>    <div class="kpi-value c-green">${fmt(d.fin.totalRecebido)}</div></div>
    <div class="kpi"><div class="kpi-label">A Receber</div>   <div class="kpi-value c-amber">${fmt(d.fin.totalAReceber)}</div></div>
    <div class="kpi"><div class="kpi-label">Despesas</div>    <div class="kpi-value c-red">${fmt(d.fin.totalDespesas)}</div></div>
    <div class="kpi"><div class="kpi-label">Saldo Líquido</div><div class="kpi-value ${saldo >= 0 ? 'c-green' : 'c-red'}">${fmt(saldo)}</div></div>
  </div>`;
}

function secaoGraficos(d: RelatorioData): string {
  const maxMes = Math.max(...d.mesesData.map(m => Math.max(m.recebido, m.despesas)), 1);
  const mesesRows = d.mesesData.map(m => `
  <tr>
    <td>${h(m.label)}</td>
    <td class="r c-green">${fmt(m.recebido)}</td>
    <td>
      <div class="bar-wrap"><div class="bar" style="width:${Math.round((m.recebido/maxMes)*100)}%;background:#16a34a"></div></div>
    </td>
    <td class="r c-red">${fmt(m.despesas)}</td>
    <td>
      <div class="bar-wrap"><div class="bar" style="width:${Math.round((m.despesas/maxMes)*100)}%;background:#dc2626"></div></div>
    </td>
  </tr>`).join('');

  const maxArea = d.porArea[0]?.[1] ?? 1;
  const areaRows = d.porArea.map(([area, count]) => `
  <tr>
    <td>${h(area)}</td>
    <td class="r">${count}</td>
    <td style="width:40%">
      <div class="bar-wrap"><div class="bar" style="width:${Math.round((count/maxArea)*100)}%;background:#1d4ed8"></div></div>
    </td>
  </tr>`).join('');

  return `
  <h2>Receitas × Despesas — Últimos 6 meses</h2>
  <table>
    <thead><tr><th>Mês</th><th>Recebido</th><th>Barra</th><th>Despesas</th><th>Barra</th></tr></thead>
    <tbody>${mesesRows}</tbody>
  </table>
  <h2>Processos por Área</h2>
  ${d.porArea.length === 0 ? '<p style="color:#aaa;font-size:11px">Sem dados</p>' : `
  <table>
    <thead><tr><th>Área de Atuação</th><th>Qtd</th><th>Proporção</th></tr></thead>
    <tbody>${areaRows}</tbody>
  </table>`}`;
}

function secaoStatus(d: RelatorioData): string {
  const statusRows = ([
    ['ativo',    'Ativos',    'c-green'],
    ['suspenso', 'Suspensos', 'c-amber'],
    ['encerrado','Encerrados','c-gray' ],
    ['arquivado','Arquivados','c-gray' ],
  ] as const).map(([k, label, cls]) => `
  <tr><td>${label}</td><td class="r ${cls}">${d.porStatus[k] || 0}</td></tr>`).join('');

  const inadimRows = d.topInadimplentes.map((c, i) => `
  <tr>
    <td>${i + 1}</td>
    <td>${h(c.nome)}</td>
    <td class="r c-red">${fmt(c.total)}</td>
  </tr>`).join('');

  return `
  <h2>Status dos Processos</h2>
  <table style="max-width:320px">
    <thead><tr><th>Status</th><th>Quantidade</th></tr></thead>
    <tbody>${statusRows}</tbody>
  </table>
  <h2>Top Inadimplentes</h2>
  ${d.topInadimplentes.length === 0 ? '<p style="color:#aaa;font-size:11px">Nenhuma inadimplência</p>' : `
  <table>
    <thead><tr><th>#</th><th>Cliente</th><th>Total em Aberto</th></tr></thead>
    <tbody>${inadimRows}</tbody>
  </table>`}`;
}

function secaoClientes(d: RelatorioData): string {
  if (d.topClientes.length === 0) return '';
  const rows = d.topClientes.map(c => `
  <tr>
    <td>${h(c.nome)}</td>
    <td class="r">${'★'.repeat(c.avaliacao ?? 0)}${'☆'.repeat(5 - (c.avaliacao ?? 0))}</td>
    <td>${h(c.email || '—')}</td>
    <td>${h(c.telefone || '—')}</td>
  </tr>`).join('');

  return `
  <h2>Clientes Bem Avaliados</h2>
  <table>
    <thead><tr><th>Nome</th><th>Avaliação</th><th>E-mail</th><th>Telefone</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function secaoAudiencias(d: RelatorioData): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const proximas = d.processos
    .filter(p => p.proximaAudiencia && p.proximaAudiencia >= hoje && p.status === 'ativo')
    .sort((a, b) => (a.proximaAudiencia ?? '').localeCompare(b.proximaAudiencia ?? ''))
    .slice(0, 15);

  if (proximas.length === 0) {
    return `<h2>Próximas Audiências</h2><p style="color:#aaa;font-size:11px">Nenhuma audiência próxima</p>`;
  }

  const rows = proximas.map(p => {
    const dias = Math.ceil((new Date(p.proximaAudiencia!).getTime() - Date.now()) / 86_400_000);
    const urgente = dias <= 3 ? 'c-red' : dias <= 7 ? 'c-amber' : '';
    return `
    <tr>
      <td class="${urgente}">${fmtDate(p.proximaAudiencia!)} <span style="color:#aaa;font-size:10px">(${dias}d)</span></td>
      <td>${h(p.clienteNome || '—')}</td>
      <td style="font-family:monospace;font-size:10px">${h(p.numeroCNJ || '—')}</td>
      <td>${h(p.areaAtuacao || '—')}</td>
    </tr>`;
  }).join('');

  return `
  <h2>Próximas Audiências</h2>
  <table>
    <thead><tr><th>Data</th><th>Cliente</th><th>Nº CNJ</th><th>Área</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

const SECTION_BUILDERS: Record<string, (d: RelatorioData) => string> = {
  'section-kpis':       secaoKpis,
  'section-financeiro': secaoFinanceiro,
  'section-graficos':   secaoGraficos,
  'section-status':     secaoStatus,
  'section-clientes':   secaoClientes,
  'section-audiencias': secaoAudiencias,
};

export function printRelatorios(sectionId: string | null, data: RelatorioData) {
  const e = data.escritorio;

  const officeHeader = `
  <div class="doc-header">
    <div>
      <h1>${h(e?.nome || 'MSK Gestor')}</h1>
      ${e?.oabPrincipal ? `<p>OAB: ${h(e.oabPrincipal)}</p>` : ''}
    </div>
    <div class="doc-header-right">
      <div class="title">Relatórios — ${h(data.periodoLabel)}</div>
      <div class="sub">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>`;

  let body = officeHeader;

  if (sectionId && SECTION_BUILDERS[sectionId]) {
    body += SECTION_BUILDERS[sectionId](data);
  } else {
    // Imprime todas as seções
    body += Object.values(SECTION_BUILDERS).map(fn => fn(data)).filter(Boolean).join('');
  }

  const title = sectionId
    ? `Relatório — ${sectionId.replace('section-', '')}`
    : 'Relatórios MSK';

  openAndPrint(title, body);
}
