import React, { useState } from 'react';
import { Eye, EyeOff, Scale, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, senha);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Fundo decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      {/* Card Login */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-2xl shadow-amber-500/20 mb-5">
            <Scale className="w-10 h-10 text-white" />
          </div>
          <h1 className="font-playfair text-3xl font-bold text-[#f5f5f5] tracking-tight">
            MSK Gestor
          </h1>
          <p className="text-[#a0a0a0] mt-2 text-sm">Sistema Jurídico Integrado</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-[#f5f5f5] mb-6">Acesso ao Sistema</h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#a0a0a0] mb-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a0a0]" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-10 pr-4 py-3 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#a0a0a0] mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a0a0]" />
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-10 pr-12 py-3 text-[#f5f5f5] text-sm placeholder-[#505050] transition-colors"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-[#f5f5f5] transition-colors"
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                'Entrar no Sistema'
              )}
            </button>
          </form>

          {/* Acesso rápido */}
          <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
            <p className="text-xs text-[#505050] text-center mb-3">Acesso rápido</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { nome: 'Admin', email: 'gabrielb.arins@gmail.com', senha: 'budal2005msk', role: 'Admin' },
                { nome: 'Advogada', email: 'miriamkuchnier.adv@gmail.com', senha: 'advogada3009', role: 'Advogado' },
                { nome: 'Assistente', email: 'andreluizbudalarins@gmail.com', senha: 'Gorila@2020', role: 'Assistente' },
              ].map(u => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => { setEmail(u.email); setSenha(u.senha); }}
                  className="bg-[#1e1e1e] hover:bg-[#252525] border border-[#2a2a2a] rounded-lg px-2 py-2 text-center transition-colors group"
                >
                  <div className="text-xs font-medium text-[#a0a0a0] group-hover:text-amber-400 transition-colors">{u.nome}</div>
                  <div className="text-[10px] text-[#505050] mt-0.5">{u.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[#505050] text-xs mt-6">
          © 2026 MSK Gestor Advocacia. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
