import { useState, useEffect } from 'react';
import { X, Copy, CheckCheck, QrCode, AlertCircle, Loader2 } from 'lucide-react';
import Portal from './ui/Portal';
import { gerarPixBRCode, pixQrCodeUrl } from '../utils/pix';
import type { Lancamento, Escritorio } from '../types';

interface Props {
  lancamento: Lancamento;
  escritorio: Escritorio | null;
  onClose: () => void;
}

export default function PixModal({ lancamento: l, escritorio: e, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);

  const temChave = !!(e?.pixKey);

  const brCode = temChave ? gerarPixBRCode({
    chave:          e!.pixKey!,
    nomeRecebedor:  e!.responsavel || e!.nome,
    cidade:         e!.endereco?.cidade,
    valor:          l.valor,
    descricao:      l.descricao.slice(0, 72),
    txid:           l.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 25),
  }) : '';

  const qrUrl = temChave ? pixQrCodeUrl(brCode, 240) : '';

  function copy() {
    navigator.clipboard.writeText(brCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  const keyTypeLabels: Record<string, string> = {
    cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail',
    telefone: 'Telefone', aleatoria: 'Chave Aleatória',
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-green-400" />
              <h2 className="font-playfair text-base font-bold text-[#f5f5f5]">Cobrança via PIX</h2>
            </div>
            <button onClick={onClose} className="text-[#505050] hover:text-[#f5f5f5]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Valor */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-5 py-4 text-center">
              <p className="text-xs text-[#505050] mb-1">Valor da cobrança</p>
              <p className="text-3xl font-bold text-green-400">
                {l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-[#a0a0a0] mt-1 truncate">{l.descricao}</p>
              {l.clienteNome && (
                <p className="text-xs text-[#505050] mt-0.5">Cliente: {l.clienteNome}</p>
              )}
            </div>

            {!temChave ? (
              /* Aviso: chave PIX não configurada */
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-400 mb-1">Chave PIX não configurada</p>
                  <p className="text-xs text-[#a0a0a0] leading-relaxed">
                    Vá em <strong className="text-[#f5f5f5]">Configurações → Dados do Escritório</strong> e
                    informe sua chave PIX para gerar cobranças automaticamente.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Info da chave */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#505050]">Chave {keyTypeLabels[e!.pixKeyType ?? 'aleatoria'] ?? 'PIX'}:</span>
                  <span className="text-[#f5f5f5] font-mono">{e!.pixKey}</span>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-56 h-56 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                    {!qrLoaded && !qrError && (
                      <Loader2 className="w-8 h-8 text-[#2a2a2a] animate-spin" />
                    )}
                    {qrError && (
                      <div className="text-center p-4">
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <p className="text-xs text-[#505050]">Sem conexão para gerar o QR. Use o código abaixo.</p>
                      </div>
                    )}
                    <img
                      src={qrUrl}
                      alt="QR Code PIX"
                      className={`w-full h-full object-contain transition-opacity ${qrLoaded ? 'opacity-100' : 'opacity-0'}`}
                      style={{ position: qrLoaded ? 'static' : 'absolute' }}
                      onLoad={() => setQrLoaded(true)}
                      onError={() => setQrError(true)}
                    />
                  </div>
                  <p className="text-xs text-[#505050]">Escaneie o QR code com qualquer app bancário</p>
                </div>

                {/* Pix Copia e Cola */}
                <div>
                  <p className="text-xs text-[#505050] mb-2">PIX Copia e Cola</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 font-mono text-[10px] text-[#a0a0a0] truncate select-all cursor-text">
                      {brCode}
                    </div>
                    <button
                      onClick={copy}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        copied
                          ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                          : 'bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/30 text-[#a0a0a0] hover:text-amber-400'
                      }`}
                    >
                      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-[#303030] text-center leading-relaxed">
                  PIX estático · válido em todos os bancos · sem taxa
                </p>
              </>
            )}
          </div>

          <div className="px-6 pb-5">
            <button onClick={onClose} className="w-full py-2.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
