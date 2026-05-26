import React, { useState } from 'react';
import { AlertTriangle, Send, Phone, Mail, CheckCircle, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Inadimplencia() {
  const { clientes, setClientes, honorarios, setHonorarios, addToast } = useApp();
  const [search, setSearch] = useState('');
  const [notifyModal, setNotifyModal] = useState<string | null>(null);
  const [notifyType, setNotifyType] = useState<'email' | 'whatsapp' | 'carta'>('email');

  const inadimplentes = clientes.filter(c => c.status === 'Inadimplente');
  const filtered = inadimplentes.filter(c => {
    const q = search.toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || c.cpfCnpj.includes(q);
  });

  const getDebt = (clienteId: string) => {
    return honorarios
      .filter(h => h.clienteId === clienteId && (h.status === 'Vencido' || h.status === 'Pendente') && h.tipo !== 'Despesa')
      .reduce((sum, h) => sum + h.valor, 0);
  };

  const getOverdueLancamentos = (clienteId: string) => {
    return honorarios.filter(h =>
      h.clienteId === clienteId && h.status === 'Vencido' && h.tipo !== 'Despesa'
    );
  };

  const getDaysOverdue = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const sendNotification = () => {
    const cliente = clientes.find(c => c.id === notifyModal);
    if (!cliente) return;
    addToast(`Notificação enviada por ${notifyType === 'email' ? 'e-mail' : notifyType === 'whatsapp' ? 'WhatsApp' : 'carta'} para ${cliente.nome}`, 'success');
    setNotifyModal(null);
  };

  const markRegularized = (id: string) => {
    setClientes(prev => prev.map(c => c.id === id ? { ...c, status: 'Ativo' } : c));
    setHonorarios(prev => prev.map(h =>
      h.clienteId === id && h.status === 'Vencido'
        ? { ...h, status: 'Pago', dataPagamento: new Date().toISOString().split('T')[0] }
        : h
    ));
    addToast('Cliente regularizado com sucesso!', 'success');
  };

  const totalInadimplencia = inadimplentes.reduce((sum, c) => sum + getDebt(c.id), 0);

  const notifyCliente = clientes.find(c => c.id === notifyModal);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Alert banner */}
      <div className="flex items-center gap-4 p-4 rounded-2xl border"
        style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
        <AlertTriangle size={20} className="text-red-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            {inadimplentes.length} cliente(s) com pendências financeiras
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Total em aberto: <span className="text-red-400 font-bold">{fmtCurrency(totalInadimplencia)}</span>
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Inadimplentes', value: inadimplentes.length, color: '#ef4444' },
          { label: 'Total em Aberto', value: fmtCurrency(totalInadimplencia), color: '#f59e0b', isText: true },
          { label: 'Lançamentos Vencidos', value: honorarios.filter(h => h.status === 'Vencido').length, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl border text-center"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white border"
          style={{ background: '#141414', borderColor: '#2e2e2e' }}
          placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Client cards */}
      <div className="flex flex-col gap-4">
        {filtered.map(cliente => {
          const debt = getDebt(cliente.id);
          const overdue = getOverdueLancamentos(cliente.id);
          const maxDays = overdue.length > 0
            ? Math.max(...overdue.map(l => getDaysOverdue(l.dataVencimento)))
            : 0;

          return (
            <div key={cliente.id} className="p-5 rounded-2xl border"
              style={{
                background: '#141414',
                borderColor: maxDays > 60 ? 'rgba(239,68,68,0.3)' : '#2e2e2e',
              }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.12)' }}>
                    <AlertTriangle size={18} className="text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{cliente.nome}</p>
                    <p className="text-xs font-mono text-gray-500">{cliente.cpfCnpj}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Send size={12} />}
                    onClick={() => setNotifyModal(cliente.id)}
                  >
                    Notificar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<CheckCircle size={12} />}
                    onClick={() => markRegularized(cliente.id)}
                  >
                    Regularizar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-xl text-center"
                  style={{ background: '#1e1e1e' }}>
                  <p className="text-sm font-bold text-red-400">{fmtCurrency(debt)}</p>
                  <p className="text-xs text-gray-500">Valor em aberto</p>
                </div>
                <div className="p-3 rounded-xl text-center"
                  style={{ background: '#1e1e1e' }}>
                  <p className="text-sm font-bold text-amber-400">{overdue.length}</p>
                  <p className="text-xs text-gray-500">Parcelas vencidas</p>
                </div>
                <div className="p-3 rounded-xl text-center"
                  style={{ background: '#1e1e1e' }}>
                  <p className="text-sm font-bold text-white">{maxDays}</p>
                  <p className="text-xs text-gray-500">Dias em atraso</p>
                </div>
                <div className="p-3 rounded-xl text-center"
                  style={{ background: '#1e1e1e' }}>
                  <div className="flex items-center justify-center gap-1">
                    <Phone size={11} className="text-gray-500" />
                    <p className="text-xs text-gray-400">{cliente.telefone}</p>
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Mail size={11} className="text-gray-500" />
                    <p className="text-xs text-gray-400 truncate">{cliente.email}</p>
                  </div>
                </div>
              </div>

              {/* Overdue list */}
              {overdue.length > 0 && (
                <div className="border-t pt-3" style={{ borderColor: '#2e2e2e' }}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Lançamentos Vencidos
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {overdue.map(l => (
                      <div key={l.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(239,68,68,0.05)' }}>
                        <span className="text-xs text-gray-300">{l.descricao}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {new Date(l.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-xs font-bold text-red-400">{fmtCurrency(l.valor)}</span>
                          <Badge variant="red" size="sm">{getDaysOverdue(l.dataVencimento)}d</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-12 text-center rounded-2xl border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Nenhum cliente inadimplente encontrado</p>
          </div>
        )}
      </div>

      {/* Notify Modal */}
      <Modal open={!!notifyModal} onClose={() => setNotifyModal(null)} title="Enviar Notificação" size="sm">
        {notifyCliente && (
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-xl" style={{ background: '#1e1e1e' }}>
              <p className="text-sm font-semibold text-white">{notifyCliente.nome}</p>
              <p className="text-xs text-gray-500">{notifyCliente.email} | {notifyCliente.telefone}</p>
              <p className="text-sm font-bold text-red-400 mt-1">{fmtCurrency(getDebt(notifyCliente.id))} em aberto</p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Canal de notificação</p>
              {[
                { key: 'email' as const, label: 'E-mail', icon: <Mail size={14} /> },
                { key: 'whatsapp' as const, label: 'WhatsApp', icon: <Phone size={14} /> },
                { key: 'carta' as const, label: 'Carta de cobrança', icon: <Send size={14} /> },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setNotifyType(opt.key)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                    ${notifyType === opt.key
                      ? 'border-amber-500/50 text-amber-400'
                      : 'border-white/5 text-gray-400 hover:border-white/10'
                    }`}
                  style={{ background: notifyType === opt.key ? 'rgba(217,119,6,0.08)' : '#1e1e1e' }}
                >
                  {opt.icon}
                  <span className="text-sm">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#2e2e2e' }}>
              <Button variant="secondary" onClick={() => setNotifyModal(null)}>Cancelar</Button>
              <Button icon={<Send size={14} />} onClick={sendNotification}>Enviar Notificação</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
