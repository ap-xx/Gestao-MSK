import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, FileText, Gavel, TrendingUp, TrendingDown, AlertTriangle,
  Calendar, DollarSign, Clock, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { clientesApi, contratosApi, processosApi, lancamentosApi, avisosApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/cn';
import type { Cliente, Contrato, Processo, Lancamento, Aviso } from '../types';

const CHART_COLORS = ['#f59e0b', '#d97706', '#92400e', '#78350f', '#fbbf24', '#fcd34d'];

function KPICard({ icon: Icon, label, value, sub, color, delta, positivo }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delta?: string;
  positivo?: boolean;
}) {
  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 hover:border-amber-500/20 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {delta && (
          <span className={`text-xs font-medium flex items-center gap-1 ${positivo ? 'text-green-400' : 'text-red-400'}`}>
            {positivo ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {delta}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-[#f5f5f5] mb-1">{value}</p>
      <p className="text-sm text-[#a0a0a0]">{label}</p>
      {sub && <p className="text-xs text-[#505050] mt-1">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-4 py-3 shadow-xl">
        <p className="text-sm font-semibold text-[#f5f5f5] mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="text-xs" style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, ct, p, l, av] = await Promise.all([
        clientesApi.getAll(),
        contratosApi.getAll(),
        processosApi.getAll(),
        lancamentosApi.getAll(),
        avisosApi.getAll(),
      ]);
      setClientes(c);
      setContratos(ct);
      setProcessos(p);
      setLancamentos(l);
      setAvisos(av.filter(a => !a.lido));
    } catch {
      showToast('error', 'Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => {
    const now = new Date();
    const curM = now.getMonth();
    const curY = now.getFullYear();

    const ativos = clientes.filter(c => c.status === 'ativo').length;
    const contratosAtivos = contratos.filter(c => c.status === 'ativo').length;
    const processosAtivos = processos.filter(p => p.status === 'ativo').length;
    const recebidoMes = lancamentos
      .filter(l => {
        if (l.tipo !== 'recebimento' || l.status !== 'pago' || !l.dataPagamento) return false;
        const d = new Date(l.dataPagamento);
        return d.getMonth() === curM && d.getFullYear() === curY;
      })
      .reduce((s, l) => s + l.valor, 0);
    const aReceber = lancamentos
      .filter(l => l.tipo === 'a_receber' && l.status === 'pendente')
      .reduce((s, l) => s + l.valor, 0);

    return { ativos, contratosAtivos, processosAtivos, recebidoMes, aReceber };
  }, [clientes, contratos, processos, lancamentos]);

  const mesAtualLabel = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Dados gráfico de área (6 meses reais)
  const chartData = useMemo(() => {
    const now = new Date();
    const previstoPorMes = contratos
      .filter(c => c.status === 'ativo' && c.valorMensal)
      .reduce((s, c) => s + (c.valorMensal ?? 0), 0);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const recebido = lancamentos
        .filter(l => {
          if (l.tipo !== 'recebimento' || l.status !== 'pago' || !l.dataPagamento) return false;
          const dp = new Date(l.dataPagamento);
          return dp.getMonth() === m && dp.getFullYear() === y;
        })
        .reduce((s, l) => s + l.valor, 0);
      return {
        mes: mes.charAt(0).toUpperCase() + mes.slice(1),
        recebido,
        previsto: previstoPorMes,
      };
    });
  }, [lancamentos, contratos]);

  // Dados pizza por área
  const areaData = useMemo(() => {
    const areas: Record<string, number> = {};
    processos.forEach(p => {
      areas[p.areaAtuacao] = (areas[p.areaAtuacao] || 0) + 1;
    });
    contratos.forEach(c => {
      areas[c.areaAtuacao] = (areas[c.areaAtuacao] || 0) + 1;
    });
    return Object.entries(areas).map(([name, value]) => ({ name, value }));
  }, [processos, contratos]);

  // Próximas audiências
  const proximasAudiencias = useMemo(() => {
    const list: Array<{ processo: string; cliente: string; data: string; tipo: string; vara: string }> = [];
    processos.forEach(p => {
      p.audiencias.forEach(a => {
        if (new Date(a.data) >= new Date()) {
          list.push({
            processo: p.numeroCNJ,
            cliente: p.clienteNome,
            data: a.data,
            tipo: a.tipo,
            vara: a.vara || p.vara,
          });
        }
      });
    });
    return list.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()).slice(0, 4);
  }, [processos]);

  // Alertas críticos
  const alertas = avisos
    .filter(a => a.urgencia === 'critica' || a.urgencia === 'alta')
    .sort((a, b) => {
      const ord = { critica: 0, alta: 1, media: 2, baixa: 3 };
      return ord[a.urgencia] - ord[b.urgencia];
    })
    .slice(0, 3);

  const urgenciaStyles: Record<string, string> = {
    critica: 'border-red-500/30 bg-red-500/5',
    alta: 'border-amber-500/30 bg-amber-500/5',
    media: 'border-blue-500/30 bg-blue-500/5',
    baixa: 'border-green-500/30 bg-green-500/5',
  };
  const urgenciaText: Record<string, string> = {
    critica: 'text-red-400',
    alta: 'text-amber-400',
    media: 'text-blue-400',
    baixa: 'text-green-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // ── Widgets para Assistente (simplificado) ──────────────────
  if (user?.role === 'assistente') {
    const hoje = new Date().toDateString();
    const audienciasHoje = proximasAudiencias.filter(a => new Date(a.data).toDateString() === hoje);
    const proximas7 = proximasAudiencias.slice(0, 5);
    return (
      <div className="space-y-5 animate-fade-in-up">
        <div className="bg-gradient-to-r from-[#141414] to-[#141414] border border-[#2a2a2a] rounded-2xl p-6">
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">
            {saudacao}, {user?.nome.split(' ')[0]}! 👋
          </h1>
          <p className="text-[#a0a0a0] mt-1 text-sm">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard icon={Gavel} label="Processos ativos" value={kpis.processosAtivos} color="bg-purple-500/15 text-purple-400" />
          <KPICard icon={Calendar} label="Audiências hoje" value={audienciasHoje.length} color="bg-amber-500/15 text-amber-400" />
          <KPICard icon={AlertTriangle} label="Avisos não lidos" value={avisos.length} color="bg-red-500/15 text-red-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-[#f5f5f5]">Próximas Audiências</h3>
            </div>
            {proximas7.length === 0
              ? <p className="text-[#505050] text-sm text-center py-6">Nenhuma audiência agendada</p>
              : proximas7.map((a, i) => {
                const dias = Math.ceil((new Date(a.data).getTime() - Date.now()) / 86400000);
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-[#1e1e1e] rounded-lg mb-2 last:mb-0 hover:bg-[#252525]">
                    <div className="text-center min-w-[40px]">
                      <p className="text-amber-400 font-bold text-lg leading-none">{new Date(a.data).getDate()}</p>
                      <p className="text-[#505050] text-xs uppercase">{new Date(a.data).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#f5f5f5] truncate">{a.cliente}</p>
                      <p className="text-xs text-[#a0a0a0]">{a.tipo}</p>
                    </div>
                    <span className={`text-xs font-medium ${dias <= 7 ? 'text-red-400' : 'text-amber-400'}`}>{dias}d</span>
                  </div>
                );
              })}
          </div>
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="font-semibold text-[#f5f5f5]">Alertas Urgentes</h3>
            </div>
            {alertas.length === 0
              ? <div className="flex flex-col items-center py-6 text-[#505050]"><Clock className="w-8 h-8 mb-2" /><p className="text-sm">Sem alertas urgentes</p></div>
              : alertas.map(a => (
                <div key={a.id} className={`border-l-2 rounded-lg px-3 py-3 mb-2 last:mb-0 ${urgenciaStyles[a.urgencia]}`}>
                  <p className={`text-xs font-bold uppercase ${urgenciaText[a.urgencia]}`}>{a.urgencia}</p>
                  <p className="text-sm font-medium text-[#f5f5f5]">{a.titulo}</p>
                  <p className="text-xs text-[#a0a0a0] mt-0.5 line-clamp-1">{a.descricao}</p>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Banner de boas-vindas */}
      <div className="bg-gradient-to-r from-[#141414] to-[#1a1500] border border-amber-500/20 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">
              {saudacao}, {user?.nome.split(' ')[0]}! 👋
            </h1>
            <p className="text-[#a0a0a0] mt-1 text-sm">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {user?.oab && (
              <p className="text-amber-400/70 text-xs mt-2">OAB {user.oab}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-[#505050] mb-1">Resumo do mês</p>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(kpis.recebidoMes)}</p>
            <p className="text-xs text-[#a0a0a0]">recebido em {mesAtualLabel}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Clientes Ativos"
          value={kpis.ativos}
          sub={`${clientes.length} total`}
          color="bg-blue-500/15 text-blue-400"
          delta="+2 este mês"
          positivo
        />
        <KPICard
          icon={FileText}
          label="Contratos Ativos"
          value={kpis.contratosAtivos}
          sub={`${contratos.length} total`}
          color="bg-green-500/15 text-green-400"
        />
        <KPICard
          icon={Gavel}
          label="Processos Ativos"
          value={kpis.processosAtivos}
          sub={`${processos.length} total`}
          color="bg-purple-500/15 text-purple-400"
        />
        <KPICard
          icon={DollarSign}
          label="A Receber"
          value={formatCurrency(kpis.aReceber)}
          sub="lançamentos pendentes"
          color="bg-amber-500/15 text-amber-400"
          delta="Este mês"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de área */}
        <div className="lg:col-span-2 bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="font-semibold text-[#f5f5f5] mb-1">Receitas — Recebido vs. Previsto</h3>
          <p className="text-xs text-[#505050] mb-4">Últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradRecebido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPrevisto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6b7280" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="mes" tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#a0a0a0', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#a0a0a0' }} />
              <Area type="monotone" dataKey="recebido" name="Recebido" stroke="#f59e0b" strokeWidth={2} fill="url(#gradRecebido)" />
              <Area type="monotone" dataKey="previsto" name="Previsto" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" fill="url(#gradPrevisto)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pizza por área */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <h3 className="font-semibold text-[#f5f5f5] mb-1">Distribuição por Área</h3>
          <p className="text-xs text-[#505050] mb-2">Processos + Contratos</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie
                data={areaData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
              >
                {areaData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val, name) => [val, name]}
                contentStyle={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {areaData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-[#a0a0a0]">{item.name}</span>
                </div>
                <span className="text-[#f5f5f5] font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audiências + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Próximas audiências */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-[#f5f5f5]">Próximas Audiências</h3>
          </div>
          <div className="space-y-3">
            {proximasAudiencias.length === 0 ? (
              <p className="text-[#505050] text-sm text-center py-4">Nenhuma audiência agendada</p>
            ) : (
              proximasAudiencias.map((a, i) => {
                const diasRestantes = Math.ceil((new Date(a.data).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-[#1e1e1e] rounded-lg hover:bg-[#252525] transition-colors">
                    <div className="text-center min-w-[40px]">
                      <p className="text-amber-400 font-bold text-lg leading-none">
                        {new Date(a.data).getDate()}
                      </p>
                      <p className="text-[#505050] text-xs uppercase">
                        {new Date(a.data).toLocaleDateString('pt-BR', { month: 'short' })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#f5f5f5] truncate">{a.cliente}</p>
                      <p className="text-xs text-[#a0a0a0] truncate">{a.tipo}</p>
                      <p className="text-xs text-[#505050] truncate">{a.vara}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-medium ${diasRestantes <= 7 ? 'text-red-400' : diasRestantes <= 30 ? 'text-amber-400' : 'text-green-400'}`}>
                        {diasRestantes}d
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alertas urgentes */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-[#f5f5f5]">Alertas Urgentes</h3>
            {alertas.length > 0 && (
              <span className="bg-red-500/20 text-red-400 text-xs font-bold rounded-full px-2 py-0.5 ml-auto">
                {alertas.length}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {alertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#505050]">
                <Clock className="w-8 h-8 mb-2" />
                <p className="text-sm">Nenhum alerta urgente</p>
              </div>
            ) : (
              alertas.map(alerta => (
                <div
                  key={alerta.id}
                  className={`border-l-2 rounded-lg px-3 py-3 ${urgenciaStyles[alerta.urgencia]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold uppercase ${urgenciaText[alerta.urgencia]}`}>
                      {alerta.urgencia}
                    </span>
                    {alerta.dataLimite && (
                      <span className="text-xs text-[#505050] ml-auto">
                        {new Date(alerta.dataLimite).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#f5f5f5]">{alerta.titulo}</p>
                  <p className="text-xs text-[#a0a0a0] mt-0.5 line-clamp-2">{alerta.descricao}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
