import React, { useState, useEffect } from 'react';
import { Scale, KeyRound, Monitor, AlertCircle, CheckCircle2 } from 'lucide-react';
import { validateLicenseKey, formatKeyInput } from '../utils/license';
import { LicenseDB } from '../data/db';
import { licenseApi } from '../services/api';

interface Props {
  onActivated: () => void;
}

export default function LicenseGate({ onActivated }: Props) {
  const [machineName, setMachineName] = useState('');
  const [licenseKey,  setLicenseKey]  = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);

  // Mark that this machine has seen the LicenseGate.
  // Used in App.tsx to prevent the "had seeded data = legacy machine" false positive.
  useEffect(() => {
    localStorage.setItem('msk_gate_shown', '1');
  }, []);

  const handleKeyInput = (v: string) => {
    setError('');
    setLicenseKey(formatKeyInput(v));
  };

  const handleActivate = async () => {
    setError('');
    const trimName = machineName.trim();
    if (!trimName) { setError('Informe o nome desta máquina.'); return; }
    if (!validateLicenseKey(licenseKey)) {
      setError('Chave de licença inválida. Verifique e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      const machineId = LicenseDB.getMachineId();
      const now = new Date().toISOString();
      LicenseDB.set({
        machineId,
        machineName: trimName,
        licenseKey:  licenseKey.trim().toUpperCase(),
        activatedAt: now,
        lastLogin:   now,
        loginCount:  0,
      });

      // Success feedback
      setSuccess(true);

      // Background: fetch geolocation + report to server
      void licenseApi.fetchGeo();
      void licenseApi.reportToServer();

      // Small delay so the user sees the success state
      setTimeout(onActivated, 900);
    } catch {
      setError('Erro ao ativar a licença. Tente novamente.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleActivate();
  };

  const keyFull = licenseKey.length === 23; // MSK-XXXX-XXXX-XXXX-XXXX = 23 chars
  const keyValid = keyFull && validateLicenseKey(licenseKey);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">

      {/* Brand */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-2xl shadow-amber-500/30">
          <Scale className="w-7 h-7 text-white" />
        </div>
        <div className="text-center">
          <p className="font-playfair text-xl font-bold text-[#f5f5f5]">MSK Gestor</p>
          <p className="text-xs text-[#505050]">Sistema Jurídico</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 shadow-2xl">

        {success ? (
          /* ─ Success state ─ */
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-[#f5f5f5] font-semibold mb-1">Licença ativada!</p>
              <p className="text-sm text-[#505050]">Carregando o sistema…</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h1 className="text-base font-semibold text-[#f5f5f5]">Ative sua licença</h1>
              </div>
              <p className="text-xs text-[#505050] leading-relaxed">
                Este dispositivo ainda não está licenciado. Solicite uma chave
                de licença ao administrador do sistema.
              </p>
            </div>

            {/* Machine name */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">
                <Monitor className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                Nome desta máquina
              </label>
              <input
                type="text"
                value={machineName}
                onChange={e => { setError(''); setMachineName(e.target.value); }}
                onKeyDown={handleKeyDown}
                placeholder="Ex: PC Recepção, Notebook Dra. Miriam"
                maxLength={50}
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] focus:border-amber-500/50 rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#404040] outline-none transition-colors"
              />
            </div>

            {/* License key */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">
                <KeyRound className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                Chave de licença
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={e => handleKeyInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="MSK-XXXX-XXXX-XXXX-XXXX"
                spellCheck={false}
                className={[
                  'w-full bg-[#1e1e1e] border rounded-lg px-3 py-2.5 text-sm font-mono placeholder-[#404040] outline-none transition-colors',
                  keyFull
                    ? keyValid
                      ? 'border-emerald-500/50 text-emerald-400'
                      : 'border-red-500/50 text-red-400'
                    : 'border-[#2a2a2a] focus:border-amber-500/50 text-[#f5f5f5]',
                ].join(' ')}
              />
              {keyFull && !keyValid && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Chave inválida
                </p>
              )}
              {keyFull && keyValid && (
                <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Chave válida
                </p>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Button */}
            <button
              onClick={() => void handleActivate()}
              disabled={loading || !machineName.trim() || !keyValid}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/30 disabled:cursor-not-allowed text-black font-semibold text-sm py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Ativando…' : 'Ativar licença'}
            </button>

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-[#2a2a2a] text-center">
              <p className="text-xs text-[#404040]">
                Não tem uma chave?{' '}
                <span className="text-[#505050]">
                  Contate o administrador do sistema.
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      <p className="mt-6 text-[10px] text-[#303030]">
        MSK Gestor · Licença de uso interno
      </p>
    </div>
  );
}
