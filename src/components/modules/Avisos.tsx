import React, { useState } from 'react';
import { Plus, Search, Calendar, Clock, AlertTriangle, Bell, CheckCircle, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Aviso } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Select, Textarea } from '../ui/Input';
import Badge from '../ui/Badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const urgencyVariant = (u: string) =>
  u === 'Alta' ? 'red' : u === 'Média' ? 'gold' : 'green';

const tipoIcon = (t: string) => {
  if (t === 'Prazo') return <Clock size={16} />;
  if (t === 'Audiência') return <Calendar size={16} />;
  if (t === 'Alerta') return <AlertTriangle size={16} />;
  return <Bell size={16} />;
};

const tipoColor = (t: string) => {
  if (t === 'Prazo') return '#f59e0b';
  if (t === 'Audiência') return '#60a5fa';
  if (t === 'Alerta') return '#ef4444';
  return '#a78bfa';
};

const emptyAviso: Omit<Aviso, 'id'> = {
  titulo: '', descricao: '', tipo: 'Prazo', urgencia: 'Média',
  dataEvento: '', processoId: '', clienteId: '', clienteNome: '',
  processoNumero: '', status: 'Pendente', lido: false,
};

export default function Avisos() {
  const { avisos, setAvisos, clientes, processos, addToast } = useApp();
  const [search, setSearch] = useState('');
  const [filterUrgencia, setFilterUrgencia] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStatus, setFilterStatus] = useState('Pendente');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<Aviso, 'id'>>(emptyAviso);

  const filtered = avisos.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.titulo.toLowerCase().includes(q)
      || (a.clienteNome || '').toLowerCase().includes(q);
    const matchUrgencia = !filterUrgencia || a.urgencia === filterUrgencia;
    const matchTipo = !filterTipo || a.tipo === filterTipo;
    const matchStatus = !filterStatus || a.status === filterStatus;
    return matchSearch && matchUrgencia && matchTipo && matchStatus;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const urgOrder = { Alta: 0, Média: 1, Baixa: 2 };
    return urgOrder[a.urgencia] - urgOrder[b.urgencia] || a.dataEvento.localeCompare(b.dataEvento);
  });

  const openNew = () => {
    setForm(emptyAviso);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.titulo || !form.dataEvento) {
      addToast('Preencha título e data do evento', 'error');
      return;
    }
    const cliente = clientes.find(c => c.id === form.clienteId);
    const processo = processos.find(p => p.id === form.processoId);
    setAvisos(prev => [...prev, {
      ...form,
      clienteNome: cliente?.nome || '',
      processoNumero: processo?.numeroCNJ || '',
      id: `av${Date.now()}`,
    }]);
    addToast('Aviso criado com sucesso!', 'success');
    setModalOpen(false);
  };

  const markDone = (id: string) => {
    setAvisos(prev => prev.map(a => a.id === id ? { ...a, status: 'Concluído', lido: true } : a));
    addToast('Aviso concluído!', 'success');
  };

  const deleteAviso = (id: string) => {
    setAvisos(prev => prev.filter(a => a.id !== id));
    addToast('Aviso removido', 'success');
  };

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const clienteProcessos = processos.filter(p => p.clienteId === form.clienteId);

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white border"
              style={{ background: '#141414', borderColor: '#2e2e2e' }}
              placeholder="Buscar aviso..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterUrgencia} onChange={e => setFilterUrgencia(e.target.value)}>
            <option value="">Urgência</option>
            <option>Alta</option><option>Média</option><option>Baixa</option>
          </select>
          <select className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="">Tipo</option>
            <option>Prazo</option><option>Audiência</option><option>Alerta</option><option>Lembrete</option>
          </select>
          <select className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="Pendente">Pendentes</option>
            <option value="Concluído">Concluídos</option>
          </select>
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>Novo Aviso</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Urgentes', value: avisos.filter(a => a.urgencia === 'Alta' && a.status === 'Pendente').length, color: '#ef4444' },
          { label: 'Audiências', value: avisos.filter(a => a.tipo === 'Audiência' && a.status === 'Pendente').length, color: '#60a5fa' },
          { label: 'Prazos', value: avisos.filter(a => a.tipo === 'Prazo' && a.status === 'Pendente').length, color: '#f59e0b' },
          { label: 'Concluídos', value: avisos.filter(a => a.status === 'Concluído').length, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl border text-center"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Aviso cards */}
      <div className="flex flex-col gap-3">
        {sortedFiltered.map(av => {
          const daysUntil = getDaysUntil(av.dataEvento);
          const isOverdue = daysUntil < 0;
          const isSoon = daysUntil >= 0 && daysUntil <= 7;

          return (
            <div key={av.id}
              className={`p-4 rounded-2xl border transition-all ${!av.lido ? 'border-l-4' : ''}`}
              style={{
                background: '#141414',
                borderColor: !av.lido
                  ? av.urgencia === 'Alta' ? '#ef4444'
                  : av.urgencia === 'Média' ? '#f59e0b' : '#10b981'
                  : '#2e2e2e',
              }}>
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${tipoColor(av.tipo)}15`, color: tipoColor(av.tipo) }}>
                  {tipoIcon(av.tipo)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h4 className={`text-sm font-semibold ${av.status === 'Concluído' ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {av.titulo}
                      </h4>
                      {av.clienteNome && (
                        <p className="text-xs text-gray-500">{av.clienteNome}</p>
                      )}
                      {av.processoNumero && (
                        <p className="text-xs font-mono" style={{ color: '#d97706' }}>{av.processoNumero}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={urgencyVariant(av.urgencia) as any} size="sm">{av.urgencia}</Badge>
                      <Badge variant={av.tipo === 'Audiência' ? 'blue' : av.tipo === 'Alerta' ? 'red' : 'gold'} size="sm">
                        {av.tipo}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-1">{av.descricao}</p>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-gray-500" />
                      <span className={`text-xs font-medium ${isOverdue ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-gray-400'}`}>
                        {format(new Date(av.dataEvento + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        {isOverdue && ` (${Math.abs(daysUntil)}d atrasado)`}
                        {!isOverdue && isSoon && ` (em ${daysUntil}d)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {av.status === 'Pendente' && (
                        <button
                          onClick={() => markDone(av.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                          title="Marcar como concluído"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteAviso(av.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {sortedFiltered.length === 0 && (
          <div className="p-12 text-center rounded-2xl border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Nenhum aviso encontrado</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Aviso" size="lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Título *" value={form.titulo} onChange={f('titulo')} placeholder="Título do aviso..." />
            </div>
            <Select label="Tipo *" value={form.tipo} onChange={f('tipo')}
              options={[
                { value: 'Prazo', label: 'Prazo Processual' },
                { value: 'Audiência', label: 'Audiência' },
                { value: 'Alerta', label: 'Alerta' },
                { value: 'Lembrete', label: 'Lembrete' },
              ]} />
            <Select label="Urgência *" value={form.urgencia} onChange={f('urgencia')}
              options={[
                { value: 'Alta', label: 'Alta' },
                { value: 'Média', label: 'Média' },
                { value: 'Baixa', label: 'Baixa' },
              ]} />
            <Input label="Data do Evento *" type="date" value={form.dataEvento} onChange={f('dataEvento')} />
            <Select label="Cliente" value={form.clienteId || ''} onChange={f('clienteId')}
              options={[{ value: '', label: 'Sem cliente' }, ...clientes.map(c => ({ value: c.id, label: c.nome }))]} />
            <div className="sm:col-span-2">
              <Select label="Processo" value={form.processoId || ''} onChange={f('processoId')}
                options={[{ value: '', label: 'Sem processo' }, ...clienteProcessos.map(p => ({ value: p.id, label: `${p.numeroCNJ} — ${p.clienteNome}` }))]} />
            </div>
            <div className="sm:col-span-2">
              <Textarea label="Descrição *" value={form.descricao} onChange={f('descricao')}
                placeholder="Descreva o aviso em detalhes..." rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#2e2e2e' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Criar Aviso</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
