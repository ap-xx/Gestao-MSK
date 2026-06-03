import { useState } from 'react';
import {
  Sun, Moon, Palette, RefreshCw, Upload, Download, Loader2, AlertCircle,
} from 'lucide-react';
import { useTheme, ACCENT_OPTIONS } from '../../context/ThemeContext';
import { backupApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';

// ─── Manual Sync (Option C) ───────────────────────────────────
// Stores the backup on the server so another PC can pull it.
// The server endpoint reuses the existing backup infrastructure.

const SERVER_BASE = (import.meta.env?.VITE_API_URL as string | undefined)
  ?? 'https://gestao-msk.onrender.com/api';

function getToken() { return sessionStorage.getItem('msk_token') ?? ''; }

async function pushToServer(): Promise<{ ok: boolean; message: string }> {
  const tok = getToken();
  if (!tok) return { ok: false, message: 'Faça login com o servidor ativo antes de sincronizar.' };

  const data = await backupApi.exportar();
  const res  = await fetch(`${SERVER_BASE}/backup/sync`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
    signal:  AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    return { ok: false, message: err?.error ?? `Erro ${res.status}` };
  }
  return { ok: true, message: 'Dados enviados ao servidor com sucesso!' };
}

async function pullFromServer(): Promise<{ ok: boolean; message: string }> {
  const tok = getToken();
  if (!tok) return { ok: false, message: 'Faça login com o servidor ativo antes de sincronizar.' };

  const res = await fetch(`${SERVER_BASE}/backup/sync`, {
    headers: { Authorization: `Bearer ${tok}` },
    signal:  AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    return { ok: false, message: err?.error ?? `Erro ${res.status}` };
  }
  const data = await res.json();
  await backupApi.importar(data);
  return { ok: true, message: 'Dados recebidos e aplicados com sucesso!' };
}

// ─── AbaAparencia ─────────────────────────────────────────────

export default function AbaAparencia() {
  const { showToast }       = useToast();
  const { theme, accent, setTheme, setAccent } = useTheme();
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);

  async function handlePush() {
    setPushing(true);
    try {
      const r = await pushToServer();
      showToast(r.ok ? 'success' : 'warning', r.ok ? 'Sincronização' : 'Aviso', r.message);
    } catch (e: any) { showToast('error', 'Erro', e.message); }
    finally { setPushing(false); }
  }

  async function handlePull() {
    setPulling(true);
    try {
      const r = await pullFromServer();
      if (r.ok) showToast('success', 'Sincronização', r.message + ' Recarregue a página.');
      else showToast('warning', 'Aviso', r.message);
    } catch (e: any) { showToast('error', 'Erro', e.message); }
    finally { setPulling(false); }
  }

  const btnBase = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50';

  return (
    <div className="space-y-5 max-w-xl">

      {/* ── Tema ── */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="font-semibold text-[#f5f5f5] text-sm flex items-center gap-2 mb-4">
          {theme === 'dark' ? <Moon className="w-4 h-4 text-[#a0a0a0]" /> : <Sun className="w-4 h-4 text-amber-400" />}
          Tema
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'dark',  label: 'Escuro',  icon: Moon,  desc: 'Interface escura — padrão'  },
            { key: 'light', label: 'Claro',   icon: Sun,   desc: 'Interface clara e limpa'    },
          ] as const).map(opt => (
            <button
              key={opt.key}
              onClick={() => setTheme(opt.key)}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                theme === opt.key
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-[#2a2a2a] bg-[#1e1e1e] hover:border-[#3a3a3a]'
              }`}
            >
              <opt.icon className={`w-5 h-5 mt-0.5 shrink-0 ${theme === opt.key ? 'text-amber-400' : 'text-[#505050]'}`} />
              <div>
                <p className={`text-sm font-medium ${theme === opt.key ? 'text-[#f5f5f5]' : 'text-[#a0a0a0]'}`}>{opt.label}</p>
                <p className="text-xs text-[#505050] mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Cor de destaque ── */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="font-semibold text-[#f5f5f5] text-sm flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-[#a0a0a0]" /> Cor de Destaque
        </h3>
        <div className="flex flex-wrap gap-3">
          {ACCENT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setAccent(opt.key)}
              title={opt.label}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                accent === opt.key
                  ? 'border-current opacity-100 shadow-lg scale-105'
                  : 'border-[#2a2a2a] bg-[#1e1e1e] text-[#a0a0a0] hover:border-[#3a3a3a] opacity-70 hover:opacity-100'
              }`}
              style={accent === opt.key ? {
                color:           opt.hex,
                borderColor:     opt.hex + '60',
                backgroundColor: opt.hex + '12',
              } : {}}
            >
              <span
                className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: opt.hex }}
              />
              {opt.label}
              {accent === opt.key && <span className="text-[10px] ml-1">✓</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#505050] mt-3">
          A cor de destaque é aplicada em botões, links, badges e indicadores de seleção.
        </p>
      </div>

      {/* ── Sincronização manual entre PCs (Opção C) ── */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="font-semibold text-[#f5f5f5] text-sm flex items-center gap-2 mb-1">
          <RefreshCw className="w-4 h-4 text-[#a0a0a0]" /> Sincronização entre Computadores
        </h3>
        <p className="text-xs text-[#505050] mb-4 leading-relaxed">
          Envie os dados deste PC para o servidor e/ou receba os dados de outro PC.
          Use <strong className="text-[#a0a0a0]">Enviar</strong> antes de trocar de computador
          e <strong className="text-[#a0a0a0]">Receber</strong> ao chegar no novo PC.
        </p>

        <div className="flex gap-3">
          <button onClick={handlePush} disabled={pushing || pulling}
            className={`flex-1 ${btnBase} bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/30 text-[#a0a0a0] hover:text-amber-400`}>
            {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {pushing ? 'Enviando…' : 'Enviar para servidor'}
          </button>
          <button onClick={handlePull} disabled={pulling || pushing}
            className={`flex-1 ${btnBase} bg-[#1e1e1e] border border-[#2a2a2a] hover:border-green-500/30 text-[#a0a0a0] hover:text-green-400`}>
            {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {pulling ? 'Recebendo…' : 'Receber do servidor'}
          </button>
        </div>

        <div className="flex items-start gap-2 mt-3 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-[#505050] leading-relaxed">
            "Receber" substitui os dados locais pelos do servidor.
            Os dados de usuários e configurações do escritório não são afetados.
            Recarregue a página após receber para ver as alterações.
          </p>
        </div>
      </div>

    </div>
  );
}
