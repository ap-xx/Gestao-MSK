/**
 * OAuth Callback landing page — served by Vercel (always online).
 *
 * Google redirects here after authorization:
 *   https://gestao-msk.vercel.app/oauth/google?code=...&state=...
 *
 * This page then calls the Render backend to exchange the code,
 * avoiding the "APPLICATION LOADING" Render cold-start screen.
 */
import { useEffect, useState } from 'react';
import { Scale, Loader2, CheckCircle, XCircle } from 'lucide-react';

const SERVER_BASE = (import.meta.env?.VITE_API_URL as string | undefined)
  ?? 'https://msk-api.onrender.com/api';

type Status = 'loading' | 'waking' | 'success' | 'error';

export default function OAuthCallback() {
  const [status,  setStatus]  = useState<Status>('loading');
  const [message, setMessage] = useState('Processando autorização...');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');
    const error  = params.get('error');

    if (error) {
      setStatus('error');
      setMessage('Acesso negado ao Google Calendar.');
      notifyOpener('error');
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Parâmetros inválidos na URL de retorno.');
      notifyOpener('error');
      return;
    }

    exchangeCode(code, state);
  }, []);

  async function exchangeCode(code: string, state: string, retry = 0) {
    setAttempt(retry + 1);
    if (retry > 0) {
      setStatus('waking');
      setMessage(`Servidor acordando… tentativa ${retry + 1}/4 (~${retry * 15}s)`);
    }

    try {
      const res = await fetch(`${SERVER_BASE}/google/callback-exchange`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code, state }),
        signal:  AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any;
        throw new Error(err?.error ?? `Erro ${res.status}`);
      }

      setStatus('success');
      setMessage('Google Calendar conectado com sucesso! Esta janela será fechada.');
      notifyOpener('success');
      setTimeout(() => window.close(), 2000);

    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('timeout');
      const isNetwork = err?.name === 'TypeError'; // fetch() network error

      if ((isTimeout || isNetwork) && retry < 3) {
        // Server is waking up — wait 15 s and retry
        await sleep(15_000);
        return exchangeCode(code, state, retry + 1);
      }

      setStatus('error');
      setMessage(err?.message ?? 'Erro ao conectar. Tente novamente.');
      notifyOpener('error');
    }
  }

  function notifyOpener(type: 'success' | 'error') {
    try {
      if (window.opener) window.opener.postMessage({ type: `msk-google-${type}` }, '*');
    } catch { /* cross-origin */ }
  }

  function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-500/20 mb-6">
          <Scale className="w-8 h-8 text-white" />
        </div>
        <h1 className="font-bold text-[#f5f5f5] text-lg mb-2">MSK Gestor × Google Calendar</h1>

        {/* Status */}
        <div className="mt-6 mb-4 flex flex-col items-center gap-3">
          {(status === 'loading' || status === 'waking') && (
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="w-10 h-10 text-green-400" />
          )}
          {status === 'error' && (
            <XCircle className="w-10 h-10 text-red-400" />
          )}
          <p className={`text-sm leading-relaxed ${
            status === 'error'   ? 'text-red-400'   :
            status === 'success' ? 'text-green-400' :
            'text-[#a0a0a0]'
          }`}>
            {message}
          </p>
        </div>

        {status === 'waking' && (
          <p className="text-xs text-[#505050] leading-relaxed">
            O servidor está acordando (pode levar até 60 s no primeiro acesso do dia).
            Por favor aguarde — <strong className="text-amber-400/70">não feche esta janela</strong>.
          </p>
        )}

        {status === 'error' && (
          <button
            onClick={() => window.close()}
            className="mt-4 px-5 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f5f5f5] rounded-lg text-sm transition-colors"
          >
            Fechar
          </button>
        )}
      </div>
    </div>
  );
}
