import React, { useState } from 'react';
import { Plus, Search, Edit2, FileText, DollarSign, Percent } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Contrato } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Select, Textarea } from '../ui/Input';
import Badge from '../ui/Badge';

const areasAtuacao = ['Trabalhista', 'Civil', 'Empresarial', 'Tributário', 'Família', 'Criminal', 'Previdenciário'];

const emptyContrato: Omit<Contrato, 'id'> = {
  clienteId: '', clienteNome: '', tipo: 'Mensal',
  valorMensal: undefined, percentualExito: undefined,
  areaAtuacao: 'Empresarial', dataInicio: '', dataFim: undefined,
  status: 'Ativo', descricao: '',
};

const tipoColor = (t: string) =>
  t === 'Mensal' ? 'blue' : t === 'Êxito' ? 'gold' : 'purple';

const statusVariant = (s: string) =>
  s === 'Ativo' ? 'green' : s === 'Encerrado' ? 'gray' : 'red';

const fmtCurrency = (v?: number) => v
  ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  : '—';

export default function Contratos() {
  const { contratos, setContratos, clientes, addToast } = useApp();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Contrato, 'id'>>(emptyContrato);

  const filtered = contratos.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.clienteNome.toLowerCase().includes(q) || c.areaAtuacao.toLowerCase().includes(q);
    const matchTipo = !filterTipo || c.tipo === filterTipo;
    const matchStatus = !filterStatus || c.status === filterStatus;
    return matchSearch && matchTipo && matchStatus;
  });

  const openNew = () => {
    setForm(emptyContrato);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (c: Contrato) => {
    setForm({ clienteId: c.clienteId, clienteNome: c.clienteNome, tipo: c.tipo,
      valorMensal: c.valorMensal, percentualExito: c.percentualExito,
      areaAtuacao: c.areaAtuacao, dataInicio: c.dataInicio, dataFim: c.dataFim,
      status: c.status, descricao: c.descricao });
    setEditingId(c.id);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.clienteId || !form.areaAtuacao || !form.dataInicio) {
      addToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }
    const cliente = clientes.find(c => c.id === form.clienteId);
    const nome = cliente?.nome || form.clienteNome;

    if (editingId) {
      setContratos(prev => prev.map(c => c.id === editingId ? { ...c, ...form, clienteNome: nome } : c));
      addToast('Contrato atualizado!', 'success');
    } else {
      setContratos(prev => [...prev, { ...form, clienteNome: nome, id: `ct${Date.now()}` }]);
      addToast('Contrato criado com sucesso!', 'success');
    }
    setModalOpen(false);
  };

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white border"
              style={{ background: '#141414', borderColor: '#2e2e2e' }}
              placeholder="Buscar contrato..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option>Mensal</option><option>Êxito</option><option>Misto</option>
          </select>
          <select className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option>Ativo</option><option>Suspenso</option><option>Encerrado</option>
          </select>
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>Novo Contrato</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ativos', value: contratos.filter(c => c.status === 'Ativo').length, color: '#10b981' },
          { label: 'Suspensos', value: contratos.filter(c => c.status === 'Suspenso').length, color: '#f59e0b' },
          { label: 'Encerrados', value: contratos.filter(c => c.status === 'Encerrado').length, color: '#6b7280' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl border text-center"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="card-hover p-5 rounded-2xl border flex flex-col gap-3"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(245,158,11,0.12)' }}>
                  <FileText size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{c.clienteNome}</p>
                  <p className="text-xs text-gray-500">{c.areaAtuacao}</p>
                </div>
              </div>
              <button onClick={() => openEdit(c)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                <Edit2 size={13} />
              </button>
            </div>

            <div className="flex gap-2">
              <Badge variant={tipoColor(c.tipo) as any}>{c.tipo}</Badge>
              <Badge variant={statusVariant(c.status) as any}>{c.status}</Badge>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              {(c.tipo === 'Mensal' || c.tipo === 'Misto') && c.valorMensal && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-gray-500">
                    <DollarSign size={11} /> Mensal
                  </span>
                  <span className="font-semibold text-amber-400">{fmtCurrency(c.valorMensal)}</span>
                </div>
              )}
              {(c.tipo === 'Êxito' || c.tipo === 'Misto') && c.percentualExito && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Percent size={11} /> Êxito
                  </span>
                  <span className="font-semibold text-amber-400">{c.percentualExito}%</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Início</span>
                <span className="text-gray-300">{new Date(c.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            {c.descricao && (
              <p className="text-xs text-gray-500 border-t pt-2 line-clamp-2"
                style={{ borderColor: '#2e2e2e' }}>
                {c.descricao}
              </p>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 p-12 text-center text-gray-500 text-sm rounded-2xl border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            Nenhum contrato encontrado
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar Contrato' : 'Novo Contrato'} size="lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Select label="Cliente *" value={form.clienteId} onChange={f('clienteId')}
                options={[
                  { value: '', label: 'Selecione o cliente...' },
                  ...clientes.map(c => ({ value: c.id, label: c.nome }))
                ]} />
            </div>
            <Select label="Tipo de Contrato *" value={form.tipo} onChange={f('tipo')}
              options={[
                { value: 'Mensal', label: 'Honorários Mensais' },
                { value: 'Êxito', label: 'Honorários por Êxito' },
                { value: 'Misto', label: 'Misto (Mensal + Êxito)' },
              ]} />
            <Select label="Área de Atuação *" value={form.areaAtuacao} onChange={f('areaAtuacao')}
              options={areasAtuacao.map(a => ({ value: a, label: a }))} />

            {(form.tipo === 'Mensal' || form.tipo === 'Misto') && (
              <Input label="Valor Mensal (R$)" type="number" value={form.valorMensal || ''}
                onChange={e => setForm(p => ({ ...p, valorMensal: Number(e.target.value) }))}
                placeholder="0,00" />
            )}
            {(form.tipo === 'Êxito' || form.tipo === 'Misto') && (
              <Input label="Percentual de Êxito (%)" type="number" value={form.percentualExito || ''}
                onChange={e => setForm(p => ({ ...p, percentualExito: Number(e.target.value) }))}
                placeholder="0" />
            )}

            <Input label="Data de Início *" type="date" value={form.dataInicio} onChange={f('dataInicio')} />
            <Input label="Data de Término (opcional)" type="date" value={form.dataFim || ''} onChange={f('dataFim')} />
            <Select label="Status" value={form.status} onChange={f('status')}
              options={[
                { value: 'Ativo', label: 'Ativo' },
                { value: 'Suspenso', label: 'Suspenso' },
                { value: 'Encerrado', label: 'Encerrado' },
              ]} />
            <div className="sm:col-span-2">
              <Textarea label="Descrição" value={form.descricao || ''} onChange={f('descricao')}
                placeholder="Descreva o objeto do contrato..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#2e2e2e' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Salvar Alterações' : 'Criar Contrato'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
