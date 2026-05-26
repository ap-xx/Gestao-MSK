import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, Building2, User, Phone, Mail, MapPin, Loader } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Cliente } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Select, Textarea } from '../ui/Input';
import Badge from '../ui/Badge';

const emptyCliente: Omit<Cliente, 'id' | 'dataCadastro'> = {
  nome: '', cpfCnpj: '', tipo: 'PJ', email: '', telefone: '',
  endereco: '', cidade: '', estado: '', status: 'Ativo', observacoes: '',
};

function formatCpfCnpj(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

const mockCNPJData: Record<string, Partial<Cliente>> = {
  '12345678000190': {
    nome: 'Construtora Horizonte Ltda.',
    email: 'juridico@horizonte.com.br',
    telefone: '(11) 3456-7890',
    endereco: 'Av. Paulista, 1500, Conj. 210',
    cidade: 'São Paulo',
    estado: 'SP',
    tipo: 'PJ',
  },
  '98765432000110': {
    nome: 'Grupo Tecnológico Sigma S.A.',
    email: 'legal@sigmatech.com.br',
    telefone: '(11) 4567-8901',
    endereco: 'Rua Consolação, 3000, 5° Andar',
    cidade: 'São Paulo',
    estado: 'SP',
    tipo: 'PJ',
  },
};

const mockCPFData: Record<string, Partial<Cliente>> = {
  '98765432100': {
    nome: 'Roberto Alves Ferreira',
    email: 'roberto.ferreira@email.com',
    telefone: '(11) 99876-5432',
    endereco: 'Rua das Flores, 234',
    cidade: 'Campinas',
    estado: 'SP',
    tipo: 'PF',
  },
  '12345678901': {
    nome: 'Marina Oliveira Santos',
    email: 'marina.santos@email.com',
    telefone: '(21) 99654-3210',
    endereco: 'Rua Copacabana, 456, Ap. 702',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    tipo: 'PF',
  },
};

const statusVariant = (s: string) =>
  s === 'Ativo' ? 'green' : s === 'Inadimplente' ? 'red' : 'gray';

export default function Clientes() {
  const { clientes, setClientes, addToast, setActiveModule } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Cliente, 'id' | 'dataCadastro'>>(emptyCliente);
  const [searching, setSearching] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.nome.toLowerCase().includes(q)
      || c.cpfCnpj.includes(q) || c.email.toLowerCase().includes(q);
    const matchStatus = !filterStatus || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    setForm(emptyCliente);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setForm({ nome: c.nome, cpfCnpj: c.cpfCnpj, tipo: c.tipo, email: c.email, telefone: c.telefone,
      endereco: c.endereco, cidade: c.cidade, estado: c.estado, status: c.status, observacoes: c.observacoes });
    setEditingId(c.id);
    setModalOpen(true);
  };

  const handleSearch = () => {
    const digits = form.cpfCnpj.replace(/\D/g, '');
    setSearching(true);
    setTimeout(() => {
      let data: Partial<Cliente> | undefined;
      if (digits.length <= 11) {
        data = mockCPFData[digits];
      } else {
        data = mockCNPJData[digits];
      }
      if (data) {
        setForm(f => ({ ...f, ...data }));
        addToast('Dados preenchidos automaticamente via Receita Federal', 'success');
      } else {
        addToast('CNPJ/CPF não encontrado. Preencha manualmente.', 'info');
      }
      setSearching(false);
    }, 1500);
  };

  const handleSave = () => {
    if (!form.nome || !form.cpfCnpj) {
      addToast('Preencha nome e CPF/CNPJ', 'error');
      return;
    }
    if (editingId) {
      setClientes(prev => prev.map(c => c.id === editingId ? { ...c, ...form } : c));
      addToast('Cliente atualizado com sucesso!', 'success');
    } else {
      const newCliente: Cliente = {
        ...form,
        id: `c${Date.now()}`,
        dataCadastro: new Date().toISOString().split('T')[0],
      };
      setClientes(prev => [...prev, newCliente]);
      addToast('Cliente cadastrado com sucesso!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setClientes(prev => prev.filter(c => c.id !== id));
    addToast('Cliente removido', 'success');
    setDeleteId(null);
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white border"
              style={{ background: '#141414', borderColor: '#2e2e2e' }}
              placeholder="Buscar por nome, CPF/CNPJ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2.5 rounded-xl text-sm text-white border"
            style={{ background: '#141414', borderColor: '#2e2e2e' }}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="Inadimplente">Inadimplente</option>
            <option value="Inativo">Inativo</option>
          </select>
        </div>
        <Button icon={<Plus size={16} />} onClick={openNew}>Novo Cliente</Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: clientes.length, color: '#f59e0b' },
          { label: 'Ativos', value: clientes.filter(c => c.status === 'Ativo').length, color: '#10b981' },
          { label: 'Inadimplentes', value: clientes.filter(c => c.status === 'Inadimplente').length, color: '#ef4444' },
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
                {['Cliente', 'CPF/CNPJ', 'Contato', 'Localidade', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id}
                  className="table-row-hover"
                  style={{ borderTop: i > 0 ? '1px solid #1e1e1e' : undefined }}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(245,158,11,0.12)' }}>
                        {c.tipo === 'PJ' ? <Building2 size={14} className="text-amber-400" /> : <User size={14} className="text-amber-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-white">{c.nome}</p>
                        <p className="text-xs text-gray-500">{c.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-gray-300">{c.cpfCnpj}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone size={11} /> {c.telefone}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Mail size={11} /> {c.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin size={11} /> {c.cidade}/{c.estado}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={statusVariant(c.status) as any}>{c.status}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(c.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-500 text-sm">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <div className="flex flex-col gap-4">
          {/* CNPJ/CPF with search */}
          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-1">
              CPF / CNPJ
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2.5 rounded-lg text-sm text-white border font-mono"
                style={{ background: '#1e1e1e', borderColor: '#2e2e2e' }}
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                value={form.cpfCnpj}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setForm(f => ({ ...f, cpfCnpj: formatCpfCnpj(raw), tipo: raw.length > 11 ? 'PJ' : 'PF' }));
                }}
              />
              <Button
                variant="outline"
                icon={searching ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
                onClick={handleSearch}
                loading={searching}
              >
                Buscar
              </Button>
            </div>
            <p className="text-xs text-gray-600 mt-1">Preencha o CPF/CNPJ e clique em Buscar para preenchimento automático</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Razão Social / Nome Completo" value={form.nome}
                onChange={f('nome')} placeholder="Nome do cliente" />
            </div>
            <Select label="Tipo" value={form.tipo} onChange={f('tipo')}
              options={[{ value: 'PJ', label: 'Pessoa Jurídica' }, { value: 'PF', label: 'Pessoa Física' }]} />
            <Select label="Status" value={form.status} onChange={f('status')}
              options={[
                { value: 'Ativo', label: 'Ativo' },
                { value: 'Inativo', label: 'Inativo' },
                { value: 'Inadimplente', label: 'Inadimplente' },
              ]} />
            <Input label="E-mail" type="email" value={form.email}
              onChange={f('email')} placeholder="email@exemplo.com.br" />
            <Input label="Telefone" value={form.telefone}
              onChange={f('telefone')} placeholder="(00) 00000-0000" />
            <div className="sm:col-span-2">
              <Input label="Endereço" value={form.endereco}
                onChange={f('endereco')} placeholder="Rua, número, complemento" />
            </div>
            <Input label="Cidade" value={form.cidade} onChange={f('cidade')} />
            <Input label="Estado" value={form.estado} onChange={f('estado')} placeholder="SP" />
            <div className="sm:col-span-2">
              <Textarea label="Observações" value={form.observacoes || ''}
                onChange={f('observacoes')} placeholder="Informações adicionais..." />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#2e2e2e' }}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? 'Salvar Alterações' : 'Cadastrar Cliente'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirmar Exclusão" size="sm">
        <p className="text-sm text-gray-300 mb-4">Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
