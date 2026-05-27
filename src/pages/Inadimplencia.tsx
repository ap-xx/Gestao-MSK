import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  AlertTriangle, X, Mail, MessageCircle, FileText,
  CheckCircle, Phone, Calendar, User, Building2, Loader2,
} from 'lucide-react';
import { lancamentosApi, clientesApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/cn';
import type { Cliente, Lancamento } from '../types';
import Portal from '../components/ui/Portal';

const TOKEN_KEY = 'msk_token';

function diasAtraso(dataVencimento: string): number {
  return Math.ceil((Date.now() - new Date(dataVencimento).getTime()) / (1000 * 60 * 60 * 24));
}

interface ClienteInadimplente {
  cliente: Cliente;
  lancamentos: Lancamento[];
  totalDevido: number;
  diasMaxAtraso: number;
}

// ─── Modal de Notificação ─────────────────────────────────────
interface NotifModalProps {
  clienteInadimplente: ClienteInadimplente;
  onClose: () => void;
}

function NotificacaoModal({ clienteInadimplente, onClose }: NotifModalProps) {
  const { showToast } = useToast();
  const { cliente, lancamentos, totalDevido, diasMaxAtraso } = clienteInadimplente;
  const [canal, setCanal] = useState<'email' | 'whatsapp' | 'carta'>('email');
  const [mensagemCustom, setMensagemCustom] = useState('');

  const mensagensPadrao: Record<string, string> = {
    email: `Prezado(a) ${cliente.nome},\n\nIdentificamos que existem débitos em aberto referentes aos nossos honorários advocatícios no valor total de ${formatCurrency(totalDevido)}, com ${diasMaxAtraso} dia(s) de atraso.\n\nSolicitamos que entre em contato conosco para regularização. Caso já tenha efetuado o pagamento, por favor desconsidere este comunicado.\n\nAtenciosamente,\nMSK Gestor Advocacia`,
    whatsapp: `Olá ${cliente.nome}! Identificamos débitos em aberto: ${formatCurrency(totalDevido)} (${diasMaxAtraso} dias em atraso). Por favor, entre em contato para regularização. — MSK Gestor`,
    carta: `Notificação Extrajudicial\n\nAo(À) ${cliente.nome},\n\nPor meio da presente, notificamos V.Sa. acerca de débito(s) em aberto, totalizando ${formatCurrency(totalDevido)}, com ${diasMaxAtraso} dias de inadimplência, referentes a honorários advocatícios conforme contrato firmado com este escritório.\n\nNo prazo de 5 (cinco) dias úteis a contar do recebimento desta notificação, rogamos que V.Sa. efetue a devida quitação, sob pena de adoção das medidas legais cabíveis.\n\nSão Paulo, ${new Date().toLocaleDateString('pt-BR')}\n\nMSK Gestor Advocacia`,
  };

  async function enviarNotificacao() {
    const mensagem = mensagemCustom || mensagensPadrao[canal];

    if (canal === 'email') {
      const assunto = 'Notificação de Honorários em Aberto — MSK Gestor';
      const token = sessionStorage.getItem(TOKEN_KEY);
      let enviado = false;

      if (token) {
        try {
          const res = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ para: cliente.email, assunto, corpo: mensagem }),
          });
          if (res.ok) {
            showToast('success', 'E-mail enviado!', `Para ${cliente.email}`);
            enviado = true;
          } else if (res.status !== 503) {
            const err = await res.json();
            showToast('error', 'Falha ao enviar e-mail', err.error);
            enviado = true;
          }
        } catch {
          // Servidor indisponível — cai no fallback
        }
      }

      if (!enviado) {
        const corpo = encodeURIComponent(mensagem);
        window.location.href = `mailto:${cliente.email}?subject=${encodeURIComponent(assunto)}&body=${corpo}`;
        showToast('success', 'Cliente de e-mail aberto!', `Para ${cliente.email}`);
      }
    } else if (canal === 'whatsapp') {
      const tel = (cliente.celular || cliente.telefone).replace(/\D/g, '');
      const texto = encodeURIComponent(mensagem);
      window.open(`https://wa.me/55${tel}?text=${texto}`, '_blank', 'noopener,noreferrer');
      showToast('success', 'WhatsApp aberto!', `Para ${cliente.nome}`);
    } else {
      try {
        await navigator.clipboard.writeText(mensagem);
        showToast('success', 'Texto da carta copiado!', 'Cole no Word ou editor de texto.');
      } catch {
        showToast('info', 'Copie o texto manualmente', 'Selecione o texto acima e use Ctrl+C.');
      }
    }
    onClose();
  }

  const canalIcons = {
    email: Mail,
    whatsapp: MessageCircle,
    carta: FileText,
  };

  const CanalIcon = canalIcons[canal];

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto">
      <div className="flex justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div>
            <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">Notificação de Inadimplência</h2>
            <p className="text-xs text-[#a0a0a0]">{cliente.nome}</p>
          </div>
          <button onClick={onClose} className="text-[#a0a0a0] hover:text-[#f5f5f5]"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-center">
              <p className="text-red-400 font-bold text-lg">{formatCurrency(totalDevido)}</p>
              <p className="text-xs text-[#505050]">Total devido</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-center">
              <p className="text-amber-400 font-bold text-lg">{diasMaxAtraso}d</p>
              <p className="text-xs text-[#505050]">Dias em atraso</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-center">
              <p className="text-blue-400 font-bold text-lg">{lancamentos.length}</p>
              <p className="text-xs text-[#505050]">Parcelas</p>
            </div>
          </div>

          {/* Canal */}
          <div>
            <p className="text-sm font-medium text-[#a0a0a0] mb-2">Canal de notificação</p>
            <div className="grid grid-cols-3 gap-2">
              {(['email', 'whatsapp', 'carta'] as const).map(c => {
                const Icon = canalIcons[c];
                return (
                  <button
                    key={c}
                    onClick={() => { setCanal(c); setMensagemCustom(''); }}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg border text-xs font-medium transition-all ${
                      canal === c ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-[#2a2a2a] bg-[#1e1e1e] text-[#a0a0a0]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {c === 'email' ? 'E-mail' : c === 'whatsapp' ? 'WhatsApp' : 'Carta'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mensagem */}
          <div>
            <p className="text-sm font-medium text-[#a0a0a0] mb-2">Mensagem</p>
            <textarea
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[#a0a0a0] text-xs resize-none leading-relaxed"
              rows={8}
              value={mensagemCustom || mensagensPadrao[canal]}
              onChange={e => setMensagemCustom(e.target.value)}
            />
          </div>

          {/* Contato */}
          <div className="bg-[#1e1e1e] rounded-lg p-3 space-y-1 text-xs">
            <p className="text-[#505050] mb-1">Dados de contato</p>
            <p className="text-[#a0a0a0]">✉ {cliente.email}</p>
            <p className="text-[#a0a0a0]">📞 {cliente.telefone}</p>
            {cliente.celular && <p className="text-[#a0a0a0]">📱 {cliente.celular}</p>}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm font-medium">Cancelar</button>
            <button
              onClick={enviarNotificacao}
              className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <CanalIcon className="w-4 h-4" />
              Enviar Notificação
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
    </Portal>
  );
}

export default function Inadimplencia() {
  const { showToast } = useToast();
  const [notifTarget, setNotifTarget] = useState<ClienteInadimplente | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([lancamentosApi.getAll(), clientesApi.getAll()]);
      setLancamentos(l);
      setClientes(c);
    } catch {
      showToast('error', 'Erro', 'Não foi possível carregar dados');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const inadimplentes = useMemo(() => {
    const lancamentosVencidos = lancamentos.filter(
      l => l.status === 'vencido' && l.tipo === 'a_receber' && l.clienteId
    );

    const porCliente: Record<string, Lancamento[]> = {};
    lancamentosVencidos.forEach(l => {
      if (!l.clienteId) return;
      if (!porCliente[l.clienteId]) porCliente[l.clienteId] = [];
      porCliente[l.clienteId].push(l);
    });

    return Object.entries(porCliente).map(([clienteId, lans]) => {
      const cliente = clientes.find(c => c.id === clienteId);
      if (!cliente) return null;
      const totalDevido = lans.reduce((s, l) => s + l.valor, 0);
      const diasMaxAtraso = Math.max(...lans.map(l => diasAtraso(l.dataVencimento)));
      return { cliente, lancamentos: lans, totalDevido, diasMaxAtraso };
    }).filter(Boolean) as ClienteInadimplente[];
  }, [lancamentos, clientes]);

  async function regularizar(item: ClienteInadimplente) {
    if (!window.confirm(`Marcar todos os débitos de "${item.cliente.nome}" como pagos?`)) return;
    try {
      await Promise.all(item.lancamentos.map(l =>
        lancamentosApi.update(l.id, { status: 'pago', dataPagamento: new Date().toISOString().split('T')[0] })
      ));
      showToast('success', 'Regularizado!', `${item.lancamentos.length} lançamento(s) de ${item.cliente.nome} marcados como pagos.`);
      await reload();
    } catch (err: any) {
      showToast('error', 'Erro', err.message);
    }
  }

  const totalGeral = inadimplentes.reduce((s, i) => s + i.totalDevido, 0);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Inadimplência</h1>
          <p className="text-[#a0a0a0] text-sm">{inadimplentes.length} clientes em atraso</p>
        </div>
        {inadimplentes.length > 0 && (
          <div className="ml-auto bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3 text-right">
            <p className="text-xs text-[#505050]">Total em aberto</p>
            <p className="text-xl font-bold text-red-400">{formatCurrency(totalGeral)}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : inadimplentes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#505050]">
          <CheckCircle className="w-12 h-12 mb-3 text-green-500/50" />
          <h3 className="text-lg font-semibold text-[#a0a0a0] mb-1">Sem inadimplências!</h3>
          <p className="text-sm">Todos os clientes estão em dia com seus pagamentos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {inadimplentes
            .sort((a, b) => b.diasMaxAtraso - a.diasMaxAtraso)
            .map(item => {
              const { cliente, lancamentos: lans, totalDevido, diasMaxAtraso } = item;
              const urgente = diasMaxAtraso > 30;
              return (
                <div
                  key={cliente.id}
                  className={`bg-[#141414] border rounded-xl p-5 transition-all ${urgente ? 'border-red-500/30' : 'border-amber-500/20'}`}
                >
                  {/* Client header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${urgente ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                        {cliente.tipoPessoa === 'PJ'
                          ? <Building2 className={`w-5 h-5 ${urgente ? 'text-red-400' : 'text-amber-400'}`} />
                          : <User className={`w-5 h-5 ${urgente ? 'text-red-400' : 'text-amber-400'}`} />
                        }
                      </div>
                      <div>
                        <p className="font-semibold text-[#f5f5f5] text-sm">{cliente.nome}</p>
                        <p className="text-xs text-[#505050]">{cliente.tipoPessoa === 'PJ' ? cliente.cnpj : cliente.cpf}</p>
                      </div>
                    </div>
                    {urgente && (
                      <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        CRÍTICO
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center bg-[#1e1e1e] rounded-lg p-2">
                      <p className={`text-sm font-bold ${urgente ? 'text-red-400' : 'text-amber-400'}`}>{diasMaxAtraso}d</p>
                      <p className="text-[10px] text-[#505050]">Atraso</p>
                    </div>
                    <div className="text-center bg-[#1e1e1e] rounded-lg p-2">
                      <p className="text-sm font-bold text-[#f5f5f5]">{lans.length}</p>
                      <p className="text-[10px] text-[#505050]">Parcelas</p>
                    </div>
                    <div className="text-center bg-[#1e1e1e] rounded-lg p-2">
                      <p className={`text-sm font-bold ${urgente ? 'text-red-400' : 'text-amber-400'}`}>{formatCurrency(totalDevido).replace('R$', 'R$')}</p>
                      <p className="text-[10px] text-[#505050]">Total</p>
                    </div>
                  </div>

                  {/* Lançamentos */}
                  <div className="space-y-1.5 mb-4">
                    {lans.map(l => (
                      <div key={l.id} className="flex items-center justify-between text-xs bg-[#1e1e1e] rounded px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <Calendar className="w-3 h-3 text-[#505050] shrink-0" />
                          <span className="text-[#a0a0a0] truncate">{l.descricao}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-red-400 font-medium">{formatCurrency(l.valor)}</span>
                          <span className="text-[#505050] ml-1">({diasAtraso(l.dataVencimento)}d)</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Contato */}
                  <div className="text-xs text-[#505050] mb-4 space-y-0.5">
                    <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {cliente.email}</p>
                    <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {cliente.telefone}</p>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setNotifTarget(item)}
                      className="flex items-center justify-center gap-1.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Mail className="w-3 h-3" />
                      Notificar
                    </button>
                    <button
                      onClick={() => regularizar(item)}
                      className="flex items-center justify-center gap-1.5 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Regularizar
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {notifTarget && (
        <NotificacaoModal
          clienteInadimplente={notifTarget}
          onClose={() => setNotifTarget(null)}
        />
      )}
    </div>
  );
}
