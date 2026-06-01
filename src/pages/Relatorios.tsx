import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  BarChart2, TrendingUp, TrendingDown, Users, Gavel, FileText,
  Calendar, AlertTriangle, Printer, RefreshCw,
  CheckCircle, Star, User,
} from 'lucide-react';
import { clientesApi, processosApi, lancamentosApi, contratosApi, escritorioApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/cn';
import { printRelatorios } from '../utils/printRelatorio';
import type { Cliente, Processo, Lancamento, Contrato, Escritorio } from '../types';

// ─── Card KPI ──────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-[#505050]">{label}</p>
        <p className="text-xl font-bold text-[#f5f5f5] mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[#505050] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Mini bar ──────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Section print button (defined at module level to avoid remounts) ─────────
function SectionPrintBtn({ id, onPrint }: { id: string; onPrint: (id: string) => void }) {
  return (
    <button
      onClick={() => onPrint(id)}
      className="no-print p-1.5 text-[#505050] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors ml-auto"
      title="Imprimir esta seção"
    >
      <Printer className="w-3.5 h-3.5" />
    </button>
  );
}

export default function Relatorios() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [processos,  setProcessos]  = useState<Processo[]>([]);
  const [lancamentos,setLancamentos]= useState<Lancamento[]>([]);
  const [contratos,  setContratos]  = useState<Contrato[]>([]);
  const [escritorio, setEscritorio] = useState<Escritorio | null>(null);
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, l, ct, e] = await Promise.all([
        clientesApi.getAll(), processosApi.getAll(),
        lancamentosApi.getAll(), contratosApi.getAll(),
        escritorioApi.get().catch(() => null),
      ]);
      setClientes(c); setProcessos(p); setLancamentos(l); setContratos(ct); setEscritorio(e);
    } catch {
      showToast('error', 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  // ── Período ───────────────────────────────────────────────────
  const periodoStart = useMemo(() => {
    const now = new Date();
    if (periodo === 'mes') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    if (periodo === 'trimestre') {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
    }
    return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  }, [periodo]);

  // ── Métricas Financeiras ──────────────────────────────────────
  const fin = useMemo(() => {
    const recebimentosPeriodo = lancamentos.filter(l =>
      l.tipo === 'recebimento' && l.status === 'pago' &&
      (l.dataPagamento ?? '') >= periodoStart
    );
    const despesasPeriodo = lancamentos.filter(l =>
      l.tipo === 'despesa' && (l.dataVencimento >= periodoStart)
    );
    const aReceberTotal = lancamentos.filter(l =>
      l.tipo === 'a_receber' && (l.status === 'pendente' || l.status === 'vencido')
    );
    const vencidos = aReceberTotal.filter(l => l.status === 'vencido');

    const totalRecebido = recebimentosPeriodo.reduce((s, l) => s + l.valor, 0);
    const totalDespesas = despesasPeriodo.reduce((s, l) => s + l.valor, 0);
    const totalAReceber = aReceberTotal.reduce((s, l) => s + l.valor, 0);
    const totalVencido  = vencidos.reduce((s, l) => s + l.valor, 0);

    return { totalRecebido, totalDespesas, totalAReceber, totalVencido, vencidos };
  }, [lancamentos, periodoStart]);

  // ── Métricas por mês (últimos 6 meses) ───────────────────────
  const mesesData = useMemo(() => {
    const meses: Array<{ label: string; recebido: number; despesas: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().slice(0, 7); // YYYY-MM
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const recebido = lancamentos.filter(l =>
        l.tipo === 'recebimento' && l.status === 'pago' &&
        (l.dataPagamento ?? '').startsWith(start)
      ).reduce((s, l) => s + l.valor, 0);
      const despesas = lancamentos.filter(l =>
        l.tipo === 'despesa' && l.dataVencimento.startsWith(start)
      ).reduce((s, l) => s + l.valor, 0);
      meses.push({ label, recebido, despesas });
    }
    return meses;
  }, [lancamentos]);

  const maxMes = useMemo(() => Math.max(...mesesData.map(m => Math.max(m.recebido, m.despesas)), 1), [mesesData]);

  // ── Processos por área ────────────────────────────────────────
  const porArea = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of processos) map[p.areaAtuacao] = (map[p.areaAtuacao] || 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [processos]);

  // ── Processos por status ──────────────────────────────────────
  const porStatus = useMemo(() => {
    const map: Record<string, number> = { ativo: 0, suspenso: 0, encerrado: 0, arquivado: 0 };
    for (const p of processos) map[p.status] = (map[p.status] || 0) + 1;
    return map;
  }, [processos]);

  // ── Top clientes inadimplentes ────────────────────────────────
  const topInadimplentes = useMemo(() => {
    const map: Record<string, { nome: string; total: number }> = {};
    for (const l of fin.vencidos) {
      if (!l.clienteNome) continue;
      if (!map[l.clienteNome]) map[l.clienteNome] = { nome: l.clienteNome, total: 0 };
      map[l.clienteNome].total += l.valor;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [fin.vencidos]);

  // ── Clientes com melhor avaliação ─────────────────────────────
  const topClientes = useMemo(() =>
    [...clientes]
      .filter(c => (c.avaliacao ?? 0) >= 4)
      .sort((a, b) => (b.avaliacao ?? 0) - (a.avaliacao ?? 0))
      .slice(0, 5),
    [clientes]
  );

  // ── Produtividade por usuário ─────────────────────────────────
  const produtividade = useMemo(() => {
    const map: Record<string, { nome: string; andamentos: number; processos: number; lancamentos: number }> = {};
    for (const p of processos) {
      (p.andamentos || []).forEach(a => {
        const k = a.usuarioNome || 'Sistema';
        if (!map[k]) map[k] = { nome: k, andamentos: 0, processos: 0, lancamentos: 0 };
        map[k].andamentos++;
      });
      // Count unique users that authored andamentos
      const users = new Set((p.andamentos || []).map(a => a.usuarioNome).filter(Boolean));
      users.forEach(u => {
        if (!map[u]) map[u] = { nome: u, andamentos: 0, processos: 0, lancamentos: 0 };
        map[u].processos++;
      });
    }
    return Object.values(map).sort((a, b) => b.andamentos - a.andamentos).slice(0, 10);
  }, [processos]);

  const periodoLabel = { mes: 'Este mês', trimestre: 'Este trimestre', ano: 'Este ano' }[periodo];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <BarChart2 className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
          <p className="text-[#505050] text-sm">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  // ── Dados para impressão ────────────────────────────────────
  function relatorioData() {
    return {
      periodoLabel,
      clientes, processos, contratos, fin,
      mesesData, porArea, porStatus,
      topInadimplentes, topClientes,
      escritorio,
    };
  }

  function printSection(id: string) {
    printRelatorios(id, relatorioData());
  }

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Relatórios</h1>
          <p className="text-[#a0a0a0] text-sm">Visão geral do escritório</p>
        </div>
        <div className="ml-auto flex gap-2">
          <div className="flex bg-[#141414] border border-[#2a2a2a] rounded-lg overflow-hidden">
            {(['mes', 'trimestre', 'ano'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${periodo === p ? 'bg-amber-500/20 text-amber-400' : 'text-[#505050] hover:text-[#a0a0a0]'}`}
              >
                {p === 'mes' ? 'Mês' : p === 'trimestre' ? 'Trimestre' : 'Ano'}
              </button>
            ))}
          </div>
          <button onClick={reload} className="p-2.5 bg-[#141414] border border-[#2a2a2a] hover:border-amber-500/30 text-[#505050] hover:text-amber-400 rounded-lg transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => printRelatorios(null, relatorioData())} className="flex items-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#2a2a2a] hover:border-amber-500/30 text-[#505050] hover:text-amber-400 rounded-lg text-sm font-medium transition-all">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* ── KPIs gerais ── */}
      <div id="section-kpis" className="report-section">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#444]">Visão Geral</span>
          <SectionPrintBtn id="section-kpis" onPrint={printSection} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Users}    label="Clientes ativos"    value={clientes.filter(c => c.status === 'ativo').length} sub={`${clientes.length} total`} color="bg-amber-500/10 text-amber-400" />
          <KpiCard icon={Gavel}    label="Processos ativos"   value={porStatus.ativo} sub={`${processos.length} total`} color="bg-blue-500/10 text-blue-400" />
          <KpiCard icon={FileText} label="Contratos ativos"   value={contratos.filter(c => c.status === 'ativo').length} sub={`${contratos.length} total`} color="bg-purple-500/10 text-purple-400" />
          <KpiCard icon={AlertTriangle} label="Inadimplentes" value={fin.vencidos.length} sub={formatCurrency(fin.totalVencido)} color="bg-red-500/10 text-red-400" />
        </div>
      </div>

      {/* ── Financeiro do período ── */}
      <div id="section-financeiro" className="report-section">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#444]">Financeiro — {periodoLabel}</span>
          <SectionPrintBtn id="section-financeiro" onPrint={printSection} />
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-xs text-[#505050] mb-1">Recebido — {periodoLabel}</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(fin.totalRecebido)}</p>
          <div className="mt-3 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${fin.totalRecebido > 0 ? Math.min((fin.totalRecebido / (fin.totalRecebido + fin.totalDespesas + 1)) * 100, 100) : 0}%` }} />
          </div>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-xs text-[#505050] mb-1">A Receber</p>
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(fin.totalAReceber)}</p>
          <p className="text-xs text-red-400 mt-1">{fin.vencidos.length} vencido(s)</p>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-xs text-[#505050] mb-1">Despesas — {periodoLabel}</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(fin.totalDespesas)}</p>
          <p className={`text-xs mt-1 font-medium ${fin.totalRecebido - fin.totalDespesas >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Saldo: {formatCurrency(fin.totalRecebido - fin.totalDespesas)}
          </p>
        </div>
      </div>
      </div>{/* /section-financeiro */}

      {/* ── Gráfico barras + por área ── */}
      <div id="section-graficos" className="report-section">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#444]">Análise Financeira & Processos</span>
          <SectionPrintBtn id="section-graficos" onPrint={printSection} />
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receitas x Despesas — últimos 6 meses */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" /> Receitas × Despesas (6 meses)
          </h3>
          <div className="space-y-4">
            {mesesData.map(m => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#a0a0a0] w-8">{m.label}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-400">{formatCurrency(m.recebido)}</span>
                    <span className="text-red-400">{formatCurrency(m.despesas)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <MiniBar value={m.recebido} max={maxMes} color="bg-green-500" />
                  <MiniBar value={m.despesas} max={maxMes} color="bg-red-500" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-[#505050]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Recebido</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Despesas</span>
          </div>
        </div>

        {/* Processos por área */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
            <Gavel className="w-4 h-4 text-blue-400" /> Processos por Área
          </h3>
          {porArea.length === 0 ? (
            <p className="text-xs text-[#505050] text-center py-8">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {porArea.map(([area, count]) => (
                <div key={area}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#a0a0a0] truncate">{area}</span>
                    <span className="text-xs font-medium text-[#f5f5f5] shrink-0 ml-2">{count}</span>
                  </div>
                  <MiniBar value={count} max={porArea[0][1]} color="bg-blue-500" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>{/* /section-graficos */}

      {/* ── Status processos + Top inadimplentes ── */}
      <div id="section-status" className="report-section">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#444]">Status & Inadimplência</span>
          <SectionPrintBtn id="section-status" onPrint={printSection} />
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status processos */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" /> Status dos Processos
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['ativo',    'Ativos',    'text-green-400 bg-green-500/10'],
              ['suspenso', 'Suspensos', 'text-amber-400 bg-amber-500/10'],
              ['encerrado','Encerrados','text-red-400 bg-red-500/10'],
              ['arquivado','Arquivados','text-gray-400 bg-gray-500/10'],
            ] as const).map(([key, label, cls]) => (
              <div key={key} className={`rounded-xl p-4 ${cls.split(' ')[1]}`}>
                <p className={`text-2xl font-bold ${cls.split(' ')[0]}`}>{porStatus[key] || 0}</p>
                <p className="text-xs text-[#505050] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top inadimplentes */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" /> Top Inadimplentes
          </h3>
          {topInadimplentes.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2 text-[#505050]">
              <CheckCircle className="w-8 h-8 opacity-30" />
              <p className="text-xs">Nenhuma inadimplência</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topInadimplentes.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-[#505050] w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#f5f5f5] truncate">{c.nome}</p>
                    <MiniBar value={c.total} max={topInadimplentes[0].total} color="bg-red-500" />
                  </div>
                  <span className="text-xs text-red-400 font-medium shrink-0">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>{/* /section-status */}

      {/* ── Clientes bem avaliados ── */}
      {topClientes.length > 0 && (
        <div id="section-clientes" className="report-section bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Clientes Bem Avaliados
            <SectionPrintBtn id="section-clientes" onPrint={printSection} />
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {topClientes.map(c => (
              <div key={c.id} className="bg-[#1e1e1e] rounded-xl p-3 text-center">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg font-bold mx-auto mb-2">
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <p className="text-xs text-[#f5f5f5] font-medium truncate">{c.nome.split(' ')[0]}</p>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className={`w-2.5 h-2.5 ${i <= (c.avaliacao ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-[#3a3a3a]'}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Próximas audiências ── */}
      <div id="section-audiencias" className="report-section bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" /> Próximas Audiências
          <SectionPrintBtn id="section-audiencias" onPrint={printSection} />
        </h3>
        {(() => {
          const hoje = new Date().toISOString().slice(0, 10);
          const proximas = processos
            .filter(p => p.proximaAudiencia && p.proximaAudiencia >= hoje && p.status === 'ativo')
            .sort((a, b) => (a.proximaAudiencia ?? '').localeCompare(b.proximaAudiencia ?? ''))
            .slice(0, 8);
          return proximas.length === 0 ? (
            <p className="text-xs text-[#505050] text-center py-6">Nenhuma audiência próxima</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {proximas.map(p => {
                const dias = Math.ceil((new Date(p.proximaAudiencia!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={p.id} className="bg-[#1e1e1e] rounded-lg px-3 py-3 border border-[#2a2a2a]">
                    <p className={`text-xs font-bold ${dias <= 3 ? 'text-red-400' : dias <= 7 ? 'text-amber-400' : 'text-[#a0a0a0]'}`}>
                      {new Date(p.proximaAudiencia!).toLocaleDateString('pt-BR')}
                      <span className="ml-1 font-normal text-[#505050]">({dias}d)</span>
                    </p>
                    <p className="text-xs text-[#f5f5f5] mt-1 font-medium truncate">{p.clienteNome}</p>
                    <p className="text-[10px] text-[#505050] truncate">{p.numeroCNJ}</p>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── Produtividade ── */}
      {produtividade.length > 0 && (
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#444]">Produtividade por Usuário</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Usuário</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[#505050] uppercase tracking-wider">Andamentos</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden md:table-cell">Processos</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[#505050] uppercase tracking-wider hidden lg:table-cell">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {produtividade.map((u, i) => {
                  const maxAnd = produtividade[0].andamentos;
                  const pct = maxAnd > 0 ? Math.round((u.andamentos / maxAnd) * 100) : 0;
                  return (
                    <tr key={i} className="hover:bg-[#1a1a1a] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <span className="text-[#f5f5f5] font-medium">{u.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-amber-400 font-semibold">{u.andamentos}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell text-[#a0a0a0]">{u.processos}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#2a2a2a] rounded-full h-1.5">
                            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-[#505050] w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
