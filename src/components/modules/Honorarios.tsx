import React, { useState } from 'react';
import { Plus, Search, CheckCircle, Clock, XCircle, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Honorario } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Select, Textarea } from '../ui/Input';
import Badge from '../ui/Badge';

type TabType = 'Recebimento' | 'A Receber' | 'Despesa';

const emptyHonorario: Omit<Honorario, 'id'> = {
  clienteId: '', clienteNome: '', processoId: '', contratoId: '',
  tipo: 'A Receber', descricao: '', valor: 0,
  dataVencimento: '', dataPagamento: '',
  status: 'Pendente', formaPagamento: '', observacoes: '',
};

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusVariant = (s: string) =>
  s === 'Pago' ? 'green' : s === 'Vencido' ? 'red' : s === 'Pendente' ? 'gold' : 'gray';

export default function Honorarios() {
  const { honorarios, setHonorarios, clientes, processos, contratos, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('Recebimento');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Honorario, 'id'>>(emptyHonorario);

  const tabData = honorarios.filter(h => h.tipo === activeTab);
  const filtered = tabData.filter(h => {
    const q = search.toLowerCase();
    const matchSearch = !q || h.clienteNome.toLowerCase().includes(q) || h.descricao.toLowerCase().includes(q);
    const matchStatus = !filterStatus || h.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalRecebido = honorarios.filter(h => h.tipo === 'Recebimento' && h.status === 'Pago').reduce((s, h) => s + h.valor, 0);
  const totalAReceber = honorarios.filter(h => h.tipo === 'A Receber' && h.status !== 'Cancelado').reduce((s, h) => s + h.valor, 0);
  const totalVencido = honorarios.filter(h => h.status === 'Vencido').reduce((s, h) => s + h.valor, 0);
  const totalDespesas = honorarios.filter(h => h.tipo === 'Despesa').reduce((s, h) => s + h.valor, 0);

  const openNew = () => {
    setForm({ ...emptyHonorario, tipo: activeTab });
    setEditingId(null);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.clienteId || !form.descricao || !form.valor || !form.dataVencimento) {
      addToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    const cliente = clientes.find(c => c.id === form.clienteId);
    const nome = cliente?.nome || '';
    if (editingId) {
      setHonorarios(prev => prev.map(h => h.id === editingId ? { ...h, ...form, clienteNome: nome } : h));
      addToast('Lançamento atualizado!', 'success');
    } else {
      setHonorarios(prev => [...prev, { ...form, clienteNome: nome, id: `h${Date.now()}` }]);
      addToast('Lançamento registrado!', 'success');
    }
    setModalOpen(false);
  };

  const markPaid = (id: string) => {
    setHonorarios(prev => prev.map(h => h.id === id
      ? { ...h, status: 'Pago', dataPagamento: new Date().toISOString().split('T')[0] }
      : h
    ));
    addToast('Pagamento confirmado!', 'success');
  };

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const clienteProcessos = processos.filter(p => p.clienteId === form.clienteId);
  const clienteContratos = contratos.filter(c => c.clienteId === form.clienteId);

  const tabs: { key: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'Recebimento', label: 'Recebimentos', icon: <TrendingUp size={15} />, color: '#10b981' },
    { key: 'A Receber', label: 'A Receber', icon: <Clock size={15} />, color: '#f59e0b' },
    { key: 'Despesa', label: 'Despesas', icon: <TrendingDown size={15} />, color: '#ef4444' },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Recebido', value: totalRecebido, icon: <TrendingUp size={18} />, color: '#10b981' },
          { label: 'A Receber', value: totalAReceber, icon: <Clock size={18} />, color: '#f59e0b' },
          { label: 'Em Atraso', value: totalVencido, icon: <XCircle size={18} />, color: '#ef4444' },
          { label: 'Despesas', value: totalDespesas, icon: <TrendingDown size={18} />, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="card-hover p-4 rounded-2xl border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${s.color}18`, color: s.color }}>
                {s.icon}
              </div>
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <p className="text-lg font-bold text-white">{fmtCurrency(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b" style={{ borderColor: '#2e2e2e' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch(''); setFilterStatus(''); }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px
              ${activeTab === tab.key ? 'border-amber-500 text-amber-400' : 'border-transparent text-gray-500 hover:text-white'}`}
          >
            <span style={{ color: activeTab === tab.key ? tab.color : undefined }}>{tab.icon}</span>
            {tab.label}
            <span className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: '#1e1e1e', color: '#6b7280' }}>
              {honorarios.filter(h => h.tipo === tab.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white border"
              style={{ background: '#141414', borderColor: '#2e2e2e' }}
              placeholder="Buscar lançamento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option>Pago</option><option>Pendente</option><option>Vencido</option>
          </select>
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>Novo Lançamento</Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: '#141414', borderColor: '#2e2e2e' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e2e' }}>
                {['Descrição', 'Cliente', 'Valor', 'Vencimento', 'Pagamento', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, i) => (
                <tr key={h.id} className="table-row-hover"
                  style={{ borderTop: i > 0 ? '1px solid #1e1e1e' : undefined }}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">{h.descricao}</p>
                    {h.formaPagamento && (
                      <p className="text-xs text-gray-500">{h.formaPagamento}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-300">{h.clienteNome}</td>
                  <td className="px-5 py-4">
                    <span className={`font-bold text-sm ${h.tipo === 'Despesa' ? 'text-red-400' : 'text-amber-400'}`}>
                      {h.tipo === 'Despesa' ? '−' : '+'}{fmtCurrency(h.valor)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-400">
                    {new Date(h.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-400">
                    {h.dataPagamento
                      ? new Date(h.dataPagamento + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={statusVariant(h.status) as any}>{h.status}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      {(h.status === 'Pendente' || h.status === 'Vencido') && h.tipo !== 'Despesa' && (
                        <button
                          onClick={() => markPaid(h.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                          title="Marcar como pago"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500 text-sm">
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Lançamento" size="lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Descrição *" value={form.descricao} onChange={f('descricao')}
                placeholder="Descreva o lançamento..." />
            </div>
            <Select label="Tipo *" value={form.tipo} onChange={f('tipo')}
              options={[
                { value: 'Recebimento', label: 'Recebimento' },
                { value: 'A Receber', label: 'A Receber' },
                { value: 'Despesa', label: 'Despesa' },
              ]} />
            <Select label="Cliente *" value={form.clienteId} onChange={f('clienteId')}
              options={[{ value: '', label: 'Selecione...' }, ...clientes.map(c => ({ value: c.id, label: c.nome }))]} />
            <Select label="Processo" value={form.processoId || ''} onChange={f('processoId')}
              options={[{ value: '', label: 'Sem processo' }, ...clienteProcessos.map(p => ({ value: p.id, label: p.numeroCNJ }))]} />
            <Select label="Contrato" value={form.contratoId || ''} onChange={f('contratoId')}
              options={[{ value: '', label: 'Sem contrato' }, ...clienteContratos.map(c => ({ value: c.id, label: `${c.tipo} — ${c.areaAtuacao}` }))]} />
            <Input label="Valor (R$) *" type="number" value={form.valor || ''}
              onChange={e => setForm(p => ({ ...p, valor: Number(e.target.value) }))} placeholder="0,00" />
            <Select label="Forma de Pagamento" value={form.formaPagamento || ''} onChange={f('formaPagamento')}
              options={[
                { value: '', label: 'Selecione...' },
                { value: 'PIX', label: 'PIX' },
                { value: 'TED', label: 'TED' },
                { value: 'Boleto', label: 'Boleto' },
                { value: 'Débito', label: 'Débito' },
                { value: 'Dinheiro', label: 'Dinheiro' },
              ]} />
            <Input label="Data de Vencimento *" type="date" value={form.dataVencimento} onChange={f('dataVencimento')} />
            <Input label="Data de Pagamento" type="date" value={form.dataPagamento || ''} onChange={f('dataPagamento')} />
            <Select label="Status" value={form.status} onChange={f('status')}
              options={[
                { value: 'Pendente', label: 'Pendente' },
                { value: 'Pago', label: 'Pago' },
                { value: 'Vencido', label: 'Vencido' },
                { value: 'Cancelado', label: 'Cancelado' },
              ]} />
            <div className="sm:col-span-2">
              <Textarea label="Observações" value={form.observacoes || ''} onChange={f('observacoes')}
                placeholder="Informações adicionais..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#2e2e2e' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Registrar Lançamento</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
