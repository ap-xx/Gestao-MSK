import React, { useState } from 'react';
import { Plus, Search, Edit2, Scale, Calendar, MapPin, Gavel } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Processo } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Select, Textarea } from '../ui/Input';
import Badge from '../ui/Badge';

const areasAtuacao = ['Trabalhista', 'Civil', 'Empresarial', 'Tributário', 'Família', 'Criminal', 'Previdenciário'];
const fases = ['Conhecimento', 'Recursal', 'Execução', 'Encerrado'];
const tribunais = ['TJSP', 'TJRJ', 'TJMG', 'TRT-2', 'TRT-1', 'TRF-3', 'TRF-2', 'STJ', 'STF', 'CARF'];

const emptyProcesso: Omit<Processo, 'id'> = {
  numeroCNJ: '', clienteId: '', clienteNome: '', contratoId: '',
  vara: '', tribunal: 'TJSP', areaAtuacao: 'Trabalhista',
  fase: 'Conhecimento', polo: 'Autor', adverso: '',
  proximaAudiencia: '', dataDistribuicao: '', status: 'Ativo',
  valorCausa: undefined, resumo: '',
};

const faseColor = (f: string) =>
  f === 'Conhecimento' ? 'blue' : f === 'Recursal' ? 'gold' : f === 'Execução' ? 'purple' : 'gray';

const fmtCurrency = (v?: number) => v
  ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  : '—';

function formatCNJ(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length <= 7) return d;
  return d.replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6').slice(0, 25);
}

export default function Processos() {
  const { processos, setProcessos, clientes, contratos, addToast } = useApp();
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterFase, setFilterFase] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Processo, 'id'>>(emptyProcesso);
  const [viewProcess, setViewProcess] = useState<Processo | null>(null);

  const filtered = processos.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.clienteNome.toLowerCase().includes(q)
      || p.numeroCNJ.includes(q) || p.vara.toLowerCase().includes(q)
      || p.adverso.toLowerCase().includes(q);
    const matchArea = !filterArea || p.areaAtuacao === filterArea;
    const matchFase = !filterFase || p.fase === filterFase;
    return matchSearch && matchArea && matchFase;
  });

  const openNew = () => {
    setForm(emptyProcesso);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (p: Processo) => {
    setForm({ numeroCNJ: p.numeroCNJ, clienteId: p.clienteId, clienteNome: p.clienteNome,
      contratoId: p.contratoId, vara: p.vara, tribunal: p.tribunal, areaAtuacao: p.areaAtuacao,
      fase: p.fase, polo: p.polo, adverso: p.adverso, proximaAudiencia: p.proximaAudiencia,
      dataDistribuicao: p.dataDistribuicao, status: p.status, valorCausa: p.valorCausa, resumo: p.resumo });
    setEditingId(p.id);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.numeroCNJ || !form.clienteId || !form.vara) {
      addToast('Preencha os campos obrigatórios', 'error');
      return;
    }
    const cliente = clientes.find(c => c.id === form.clienteId);
    const nome = cliente?.nome || '';
    if (editingId) {
      setProcessos(prev => prev.map(p => p.id === editingId ? { ...p, ...form, clienteNome: nome } : p));
      addToast('Processo atualizado!', 'success');
    } else {
      setProcessos(prev => [...prev, { ...form, clienteNome: nome, id: `p${Date.now()}` }]);
      addToast('Processo cadastrado!', 'success');
    }
    setModalOpen(false);
  };

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const clienteContratos = contratos.filter(c => c.clienteId === form.clienteId);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white border"
              style={{ background: '#141414', borderColor: '#2e2e2e' }}
              placeholder="Buscar por CNJ, cliente, vara..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterArea} onChange={e => setFilterArea(e.target.value)}>
            <option value="">Todas as áreas</option>
            {areasAtuacao.map(a => <option key={a}>{a}</option>)}
          </select>
          <select className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterFase} onChange={e => setFilterFase(e.target.value)}>
            <option value="">Todas as fases</option>
            {fases.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>Novo Processo</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Ativos', value: processos.filter(p => p.status === 'Ativo').length, color: '#10b981' },
          { label: 'Conhecimento', value: processos.filter(p => p.fase === 'Conhecimento').length, color: '#60a5fa' },
          { label: 'Recursal', value: processos.filter(p => p.fase === 'Recursal').length, color: '#f59e0b' },
          { label: 'Execução', value: processos.filter(p => p.fase === 'Execução').length, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl border text-center"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: '#141414', borderColor: '#2e2e2e' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e2e' }}>
                {['Processo (CNJ)', 'Cliente', 'Tribunal / Vara', 'Área / Fase', 'Polo', 'Próx. Audiência', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className="table-row-hover"
                  style={{ borderTop: i > 0 ? '1px solid #1e1e1e' : undefined }}>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => setViewProcess(p)}
                      className="font-mono text-xs text-amber-400 hover:underline text-left"
                    >
                      {p.numeroCNJ}
                    </button>
                    {p.valorCausa && (
                      <p className="text-xs text-gray-500 mt-0.5">{fmtCurrency(p.valorCausa)}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-white text-sm">{p.clienteNome}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-white">{p.tribunal}</p>
                    <p className="text-xs text-gray-500">{p.vara}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-300">{p.areaAtuacao}</span>
                      <Badge variant={faseColor(p.fase) as any} size="sm">{p.fase}</Badge>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={p.polo === 'Autor' ? 'green' : p.polo === 'Réu' ? 'red' : 'gray'} size="sm">
                      {p.polo}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    {p.proximaAudiencia ? (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <Calendar size={11} />
                        {new Date(p.proximaAudiencia + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={p.status === 'Ativo' ? 'green' : p.status === 'Encerrado' ? 'gray' : 'gold'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-500 text-sm">
                    Nenhum processo encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewProcess && (
        <Modal open={!!viewProcess} onClose={() => setViewProcess(null)} title="Detalhes do Processo" size="lg">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: '#1e1e1e' }}>
              <Scale size={20} className="text-amber-400 shrink-0" />
              <div>
                <p className="font-mono text-amber-400 text-sm">{viewProcess.numeroCNJ}</p>
                <p className="text-xs text-gray-500">{viewProcess.tribunal} — {viewProcess.vara}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Cliente', value: viewProcess.clienteNome },
                { label: 'Adverso', value: viewProcess.adverso },
                { label: 'Área', value: viewProcess.areaAtuacao },
                { label: 'Fase', value: viewProcess.fase },
                { label: 'Polo', value: viewProcess.polo },
                { label: 'Status', value: viewProcess.status },
                { label: 'Distribuição', value: new Date(viewProcess.dataDistribuicao + 'T12:00:00').toLocaleDateString('pt-BR') },
                { label: 'Próx. Audiência', value: viewProcess.proximaAudiencia
                  ? new Date(viewProcess.proximaAudiencia + 'T12:00:00').toLocaleDateString('pt-BR')
                  : 'Não agendada' },
                { label: 'Valor da Causa', value: fmtCurrency(viewProcess.valorCausa) },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-lg"
                  style={{ background: '#1a1a1a' }}>
                  <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                  <p className="text-sm font-medium text-white">{item.value}</p>
                </div>
              ))}
            </div>
            {viewProcess.resumo && (
              <div className="p-4 rounded-xl border" style={{ borderColor: '#2e2e2e' }}>
                <p className="text-xs text-gray-500 mb-1">Resumo</p>
                <p className="text-sm text-gray-300">{viewProcess.resumo}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#2e2e2e' }}>
              <Button variant="secondary" onClick={() => setViewProcess(null)}>Fechar</Button>
              <Button onClick={() => { setViewProcess(null); openEdit(viewProcess); }}>
                Editar Processo
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar Processo' : 'Novo Processo'} size="xl">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Número CNJ *" value={form.numeroCNJ}
                onChange={e => setForm(p => ({ ...p, numeroCNJ: e.target.value }))}
                placeholder="0000000-00.0000.0.00.0000" className="font-mono" />
            </div>
            <Select label="Cliente *" value={form.clienteId} onChange={f('clienteId')}
              options={[{ value: '', label: 'Selecione...' }, ...clientes.map(c => ({ value: c.id, label: c.nome }))]} />
            <Select label="Contrato" value={form.contratoId || ''} onChange={f('contratoId')}
              options={[{ value: '', label: 'Sem contrato' }, ...clienteContratos.map(c => ({ value: c.id, label: `${c.tipo} — ${c.areaAtuacao}` }))]} />
            <Select label="Tribunal *" value={form.tribunal} onChange={f('tribunal')}
              options={tribunais.map(t => ({ value: t, label: t }))} />
            <Input label="Vara / Juízo *" value={form.vara} onChange={f('vara')} placeholder="Ex: 3ª Vara Cível" />
            <Select label="Área de Atuação *" value={form.areaAtuacao} onChange={f('areaAtuacao')}
              options={areasAtuacao.map(a => ({ value: a, label: a }))} />
            <Select label="Fase Processual *" value={form.fase} onChange={f('fase')}
              options={fases.map(f => ({ value: f, label: f }))} />
            <Select label="Polo *" value={form.polo} onChange={f('polo')}
              options={[
                { value: 'Autor', label: 'Autor (Ativo)' },
                { value: 'Réu', label: 'Réu (Passivo)' },
                { value: 'Terceiro', label: 'Terceiro Interessado' },
              ]} />
            <Input label="Parte Adversa *" value={form.adverso} onChange={f('adverso')} placeholder="Nome da parte contrária" />
            <Input label="Data de Distribuição *" type="date" value={form.dataDistribuicao} onChange={f('dataDistribuicao')} />
            <Input label="Próxima Audiência" type="date" value={form.proximaAudiencia || ''} onChange={f('proximaAudiencia')} />
            <Input label="Valor da Causa (R$)" type="number" value={form.valorCausa || ''}
              onChange={e => setForm(p => ({ ...p, valorCausa: Number(e.target.value) }))} placeholder="0,00" />
            <Select label="Status" value={form.status} onChange={f('status')}
              options={[
                { value: 'Ativo', label: 'Ativo' },
                { value: 'Suspenso', label: 'Suspenso' },
                { value: 'Encerrado', label: 'Encerrado' },
                { value: 'Arquivado', label: 'Arquivado' },
              ]} />
            <div className="sm:col-span-2">
              <Textarea label="Resumo do Processo" value={form.resumo || ''} onChange={f('resumo')}
                placeholder="Breve descrição do processo..." rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#2e2e2e' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Salvar Alterações' : 'Cadastrar Processo'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
