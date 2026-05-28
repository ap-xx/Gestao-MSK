import type { Lancamento, Escritorio } from '../types';

type Encargos = { dias: number; juros: number; multa: number; desconto: number; valorFinal: number } | null;

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');
}
function esc_html(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function printRecibo(opts: {
  numero: string;
  lancamento: Lancamento;
  escritorio: Escritorio | null;
  enc: Encargos;
}) {
  const { numero, lancamento: l, escritorio: e, enc } = opts;
  const valorFinal = enc ? enc.valorFinal : l.valor;

  /* ── Linhas da tabela de encargos ─────────────────────────── */
  const encRows = enc ? `
    <tr><td>Valor original</td><td class="r">${fmt(l.valor)}</td></tr>
    ${enc.multa > 0    ? `<tr class="c-red">  <td>+ Multa por atraso</td>                                   <td class="r">+${fmt(enc.multa)}</td></tr>` : ''}
    ${enc.juros > 0    ? `<tr class="c-amber"><td>+ Juros de mora (${enc.dias} dia${enc.dias !== 1 ? 's' : ''})</td><td class="r">+${fmt(enc.juros)}</td></tr>` : ''}
    ${enc.desconto > 0 ? `<tr class="c-green"><td>− Desconto${l.motivoDesconto ? ` (${esc_html(l.motivoDesconto)})` : ''}</td><td class="r">-${fmt(enc.desconto)}</td></tr>` : ''}
  ` : '';

  /* ── HTML completo ────────────────────────────────────────── */
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Recibo Nº ${numero}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 13px;
      line-height: 1.55;
      color: #1a1a1a;
      background: #fff;
      padding: 48px 52px;
    }

    /* ── Cabeçalho ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 2px solid #e8e8e8;
      margin-bottom: 24px;
    }
    .header-left h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-weight: 700;
      color: #111;
    }
    .header-left p { font-size: 11px; color: #666; margin-top: 3px; }
    .header-right { text-align: right; }
    .recibo-stamp {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 30px;
      font-weight: 700;
      color: #b45309;
      letter-spacing: 3px;
    }
    .recibo-num  { font-size: 12px; font-family: monospace; color: #555; margin-top: 3px; }
    .recibo-date { font-size: 11px; color: #888; margin-top: 2px; }

    /* ── Caixa de dados ── */
    .info-box {
      background: #f7f7f7;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .info-row { display: flex; gap: 12px; padding: 4px 0; }
    .info-label { color: #777; width: 140px; flex-shrink: 0; }
    .info-value { color: #111; flex: 1; }

    /* ── Destaque do valor ── */
    .value-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fffbeb;
      border: 1.5px solid #f59e0b;
      border-radius: 10px;
      padding: 16px 24px;
      margin-bottom: 20px;
    }
    .value-label  { font-size: 14px; font-weight: 500; color: #555; }
    .value-amount {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 30px;
      font-weight: 700;
      color: #b45309;
    }

    /* ── Tabela de encargos ── */
    .enc-box {
      background: #f7f7f7;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 14px 20px;
      margin-bottom: 20px;
    }
    .enc-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #666;
      margin-bottom: 10px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 3px 2px; color: #333; }
    td.r { text-align: right; }
    tr.c-red   td { color: #dc2626; }
    tr.c-amber td { color: #b45309; }
    tr.c-green td { color: #16a34a; }

    /* ── Assinatura ── */
    .signature { display: flex; justify-content: flex-end; padding-top: 44px; }
    .sig-inner { text-align: center; width: 230px; }
    .sig-line  { border-top: 1px solid #999; padding-top: 10px; }
    .sig-name  { font-size: 12px; font-weight: 500; color: #333; }
    .sig-oab   { font-size: 11px; color: #777; margin-top: 2px; }

    /* ── Rodapé ── */
    .footer {
      margin-top: 32px;
      padding-top: 14px;
      border-top: 1px solid #e8e8e8;
      text-align: center;
      font-size: 10px;
      color: #bbb;
    }

    /* ── Impressão ── */
    @media print {
      body { padding: 0; }
      @page { margin: 1.5cm; size: A4 portrait; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <h1>${esc_html(e?.nome || 'MSK Gestor')}</h1>
      ${e?.cnpj          ? `<p>CNPJ: ${esc_html(e.cnpj)}</p>` : ''}
      ${e?.oabPrincipal  ? `<p>OAB: ${esc_html(e.oabPrincipal)}</p>` : ''}
      ${e?.endereco?.logradouro
        ? `<p>${esc_html(e.endereco.logradouro)}, ${esc_html(e.endereco.numero || '')} — ${esc_html(e.endereco.cidade || '')}/${esc_html(e.endereco.uf || '')}</p>`
        : ''}
      ${e?.email         ? `<p>${esc_html(e.email)}</p>` : ''}
    </div>
    <div class="header-right">
      <div class="recibo-stamp">RECIBO</div>
      <div class="recibo-num">Nº ${numero}</div>
      <div class="recibo-date">${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>

  <div class="info-box">
    <div class="info-row">
      <span class="info-label">Recebemos de</span>
      <span class="info-value">${esc_html(l.clienteNome || '—')}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Referente a</span>
      <span class="info-value">${esc_html(l.descricao)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Forma de pagamento</span>
      <span class="info-value">${esc_html(l.formaPagamento || 'Não informado')}</span>
    </div>
    ${l.dataPagamento
      ? `<div class="info-row">
           <span class="info-label">Data de pagamento</span>
           <span class="info-value">${fmtDate(l.dataPagamento)}</span>
         </div>`
      : ''}
    ${l.observacoes
      ? `<div class="info-row">
           <span class="info-label">Observações</span>
           <span class="info-value">${esc_html(l.observacoes)}</span>
         </div>`
      : ''}
  </div>

  <div class="value-box">
    <span class="value-label">Valor recebido</span>
    <span class="value-amount">${fmt(valorFinal)}</span>
  </div>

  ${enc ? `
  <div class="enc-box">
    <div class="enc-title">Composição do valor</div>
    <table>${encRows}</table>
  </div>` : ''}

  <div class="signature">
    <div class="sig-inner">
      <div class="sig-line">
        <div class="sig-name">${esc_html(e?.responsavel || e?.nome || 'Responsável')}</div>
        ${e?.oabPrincipal ? `<div class="sig-oab">OAB ${esc_html(e.oabPrincipal)}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="footer">Documento gerado pelo MSK Gestor · ${new Date().toLocaleDateString('pt-BR')}</div>

</body>
</html>`;

  /* ── Abre janela limpa e imprime ────────────────────────────── */
  const win = window.open('', '_blank', 'width=820,height=960,scrollbars=yes');
  if (!win) {
    alert('Popups bloqueados pelo navegador.\nPermita popups para este site e tente novamente.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Aguarda carregamento das fontes antes de imprimir
  setTimeout(() => {
    win.print();
    // Fecha a janela após o diálogo de impressão (funciona na maioria dos browsers)
    win.addEventListener('afterprint', () => win.close());
    // Fallback: fecha após 60 s caso afterprint não dispare
    setTimeout(() => { try { win.close(); } catch {} }, 60_000);
  }, 600);
}
