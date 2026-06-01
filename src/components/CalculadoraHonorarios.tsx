import { useState } from 'react';
import { Calculator, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../utils/cn';

/**
 * Calculadora de Honorários — modal flutuante no canto inferior esquerdo.
 * Calcula honorários com base no valor da causa, percentual de êxito e parcelamento.
 */
export default function CalculadoraHonorarios() {
  const [open, setOpen]             = useState(false);
  const [valorCausa, setValorCausa] = useState('');
  const [percBase,   setPercBase]   = useState('10');
  const [percExito,  setPercExito]  = useState('20');
  const [parcelas,   setParcelas]   = useState('1');

  // fmtInput armazena os dígitos como centavos (divide por 100 ao exibir),
  // então aqui também dividimos por 100 para obter o valor real em reais.
  const causa  = (parseFloat(valorCausa.replace(/\D/g, '')) || 0) / 100;
  const base   = parseFloat(percBase)   || 0;
  const exito  = parseFloat(percExito)  || 0;
  const nParc  = Math.max(1, parseInt(parcelas) || 1);

  const honorBase  = causa * (base  / 100);
  const honorExito = causa * (exito / 100);
  const total      = honorBase + honorExito;
  const parcela    = total / nParc;

  function fmtInput(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    const num    = parseInt(digits || '0') / 100;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 left-6 z-40 w-11 h-11 bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/40 rounded-xl flex items-center justify-center text-[#505050] hover:text-amber-400 shadow-lg transition-all"
        title="Calculadora de Honorários"
      >
        <Calculator className="w-5 h-5" />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 left-6 z-50 w-72 bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-[#f5f5f5]">Calculadora de Honorários</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#505050] hover:text-[#f5f5f5]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Valor da causa */}
            <div>
              <label className="block text-[10px] text-[#505050] mb-1">Valor da Causa</label>
              <input
                type="text"
                inputMode="numeric"
                value={valorCausa}
                onChange={e => setValorCausa(fmtInput(e.target.value))}
                placeholder="R$ 0,00"
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#404040] outline-none focus:border-amber-500/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* % Honorários base */}
              <div>
                <label className="block text-[10px] text-[#505050] mb-1">% Honorários</label>
                <div className="relative">
                  <input
                    type="number" min={0} max={100} step={0.5}
                    value={percBase}
                    onChange={e => setPercBase(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-3 pr-7 py-2 text-sm text-[#f5f5f5] outline-none focus:border-amber-500/40"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#505050]">%</span>
                </div>
              </div>
              {/* % Êxito */}
              <div>
                <label className="block text-[10px] text-[#505050] mb-1">% Êxito</label>
                <div className="relative">
                  <input
                    type="number" min={0} max={100} step={0.5}
                    value={percExito}
                    onChange={e => setPercExito(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-3 pr-7 py-2 text-sm text-[#f5f5f5] outline-none focus:border-amber-500/40"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#505050]">%</span>
                </div>
              </div>
            </div>

            {/* Parcelas */}
            <div>
              <label className="block text-[10px] text-[#505050] mb-1">Parcelamento</label>
              <div className="flex gap-1 flex-wrap">
                {[1, 2, 3, 4, 6, 12].map(n => (
                  <button
                    key={n}
                    onClick={() => setParcelas(String(n))}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all ${parseInt(parcelas) === n ? 'bg-amber-500 text-black font-medium' : 'bg-[#1e1e1e] text-[#505050] hover:text-[#a0a0a0] border border-[#2a2a2a]'}`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            {causa > 0 && (
              <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-3 space-y-2 mt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[#505050]">Honorários ({base}%)</span>
                  <span className="text-[#f5f5f5]">{formatCurrency(honorBase)}</span>
                </div>
                {exito > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#505050]">Êxito ({exito}%)</span>
                    <span className="text-[#f5f5f5]">{formatCurrency(honorExito)}</span>
                  </div>
                )}
                <div className="border-t border-[#2a2a2a] pt-2 flex justify-between">
                  <span className="text-xs font-semibold text-[#f5f5f5]">Total</span>
                  <span className="text-sm font-bold text-amber-400">{formatCurrency(total)}</span>
                </div>
                {nParc > 1 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#505050]">{nParc}x de</span>
                    <span className="text-green-400 font-medium">{formatCurrency(parcela)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
