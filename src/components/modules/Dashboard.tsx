import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { DollarSign, Scale, AlertTriangle, Users, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { honorariosChartData, processosPorArea } from '../../data/mockData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function StatCard({
  icon, label, value, sub, color, onClick
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; onClick?: () => void;
}) {
  return (
    <div
      className={`card-hover p-5 rounded-2xl border flex items-start gap-4 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ background: '#141414', borderColor: '#2e2e2e' }}
      onClick={onClick}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
      <ArrowUpRight size={16} className="text-gray-600 shrink-0 mt-1" />
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border p-3 text-xs shadow-xl"
        style={{ background: '#1e1e1e', borderColor: '#2e2e2e' }}>
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name === 'recebido' ? 'Recebido' : 'Previsto'}: {fmtCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border p-3 text-xs shadow-xl"
        style={{ background: '#1e1e1e', borderColor: '#2e2e2e' }}>
        <p className="font-semibold text-white">{payload[0].name}</p>
        <p className="text-amber-400">{payload[0].value} processo(s)</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { clientes, processos, honorarios, avisos, setActiveModule } = useApp();

  const honorariosMes = honorarios
    .filter(h => h.tipo === 'Recebimento' && h.status === 'Pago')
    .reduce((s, h) => s + h.valor, 0);

  const processosAtivos = processos.filter(p => p.status === 'Ativo').length;
  const inadimplentes = clientes.filter(c => c.status === 'Inadimplente').length;
  const clientesAtivos = clientes.filter(c => c.status === 'Ativo').length;

  const totalInadimplencia = honorarios
    .filter(h => h.status === 'Vencido')
    .reduce((s, h) => s + h.valor, 0);

  const avisosUrgentes = avisos.filter(a => a.urgencia === 'Alta' && a.status === 'Pendente');
  const proximasAudiencias = processos
    .filter(p => p.proximaAudiencia)
    .sort((a, b) => (a.proximaAudiencia! > b.proximaAudiencia! ? 1 : -1))
    .slice(0, 4);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, #1a1200 0%, #0f0a00 50%, #0a0a0a 100%)',
          border: '1px solid rgba(217,119,6,0.3)',
        }}>
        <div className="absolute inset-0 opacity-10"
          style={{
            background: 'radial-gradient(circle at 80% 50%, rgba(245,158,11,0.4) 0%, transparent 70%)',
          }} />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-600 font-medium mb-1">{greeting},</p>
            <h2 className="text-2xl font-bold text-white msk-logo">
              MSK Consultation
            </h2>
            <p className="text-sm text-gray-400 mt-1">Advocacia & Consultoria Jurídica</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Sistema operacional
            </div>
            <p className="text-xs text-gray-600">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign size={22} />}
          label="Honorários do Mês"
          value={fmtCurrency(honorariosMes)}
          sub="Recebimentos confirmados"
          color="#f59e0b"
          onClick={() => setActiveModule('honorarios')}
        />
        <StatCard
          icon={<Scale size={22} />}
          label="Processos Ativos"
          value={String(processosAtivos)}
          sub={`${processos.length} processos no total`}
          color="#60a5fa"
          onClick={() => setActiveModule('processos')}
        />
        <StatCard
          icon={<AlertTriangle size={22} />}
          label="Inadimplência"
          value={fmtCurrency(totalInadimplencia)}
          sub={`${inadimplentes} clientes inadimplentes`}
          color="#ef4444"
          onClick={() => setActiveModule('inadimplencia')}
        />
        <StatCard
          icon={<Users size={22} />}
          label="Clientes Ativos"
          value={String(clientesAtivos)}
          sub={`${clientes.length} clientes cadastrados`}
          color="#10b981"
          onClick={() => setActiveModule('clientes')}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="xl:col-span-2 p-5 rounded-2xl border"
          style={{ background: '#141414', borderColor: '#2e2e2e' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                Honorários Mensais
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Recebido vs. Previsto — 2025</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-3 h-1 rounded-full inline-block" style={{ background: '#f59e0b' }} />
                Recebido
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-3 h-1 rounded-full inline-block" style={{ background: '#4b5563' }} />
                Previsto
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={honorariosChartData}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4b5563" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4b5563" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="previsto" stroke="#4b5563" strokeWidth={2}
                fill="url(#grayGrad)" strokeDasharray="5 5" />
              <Area type="monotone" dataKey="recebido" stroke="#f59e0b" strokeWidth={2}
                fill="url(#goldGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="p-5 rounded-2xl border"
          style={{ background: '#141414', borderColor: '#2e2e2e' }}>
          <h3 className="font-semibold text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
            Processos por Área
          </h3>
          <p className="text-xs text-gray-500 mb-4">Distribuição de atuação</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={processosPorArea}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                dataKey="count"
                nameKey="area"
              >
                {processosPorArea.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {processosPorArea.map(p => (
              <div key={p.area} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  {p.area}
                </span>
                <span className="text-xs font-semibold text-white">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Próximas Audiências */}
        <div className="p-5 rounded-2xl border"
          style={{ background: '#141414', borderColor: '#2e2e2e' }}>
          <h3 className="font-semibold text-white mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Próximas Audiências
          </h3>
          <div className="flex flex-col gap-3">
            {proximasAudiencias.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#1e1e1e' }}>
                <div className="shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center"
                  style={{ background: 'rgba(245,158,11,0.12)' }}>
                  <span className="text-sm font-bold text-amber-400 leading-none">
                    {p.proximaAudiencia ? new Date(p.proximaAudiencia + 'T12:00:00').getDate() : '—'}
                  </span>
                  <span className="text-xs text-amber-600 leading-none capitalize">
                    {p.proximaAudiencia
                      ? format(new Date(p.proximaAudiencia + 'T12:00:00'), 'MMM', { locale: ptBR })
                      : ''}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.clienteNome}</p>
                  <p className="text-xs text-gray-500 truncate">{p.vara}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-lg shrink-0"
                  style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>
                  {p.areaAtuacao}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas Urgentes */}
        <div className="p-5 rounded-2xl border"
          style={{ background: '#141414', borderColor: '#2e2e2e' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
              Alertas Urgentes
            </h3>
            <button
              onClick={() => setActiveModule('avisos')}
              className="text-xs text-amber-400 hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {avisosUrgentes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum alerta urgente</p>
            ) : (
              avisosUrgentes.map(av => (
                <div key={av.id} className="flex items-start gap-3 p-3 rounded-xl border"
                  style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{av.titulo}</p>
                    <p className="text-xs text-gray-500 truncate">{av.clienteNome}</p>
                    <p className="text-xs text-red-400 mt-1">
                      {av.dataEvento && format(new Date(av.dataEvento + 'T12:00:00'), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
