import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { SessionDB } from '../data/db';
import { auditoriaApi, licenseApi } from '../services/api';

const TOKEN_KEY   = 'msk_token';
const REFRESH_KEY = 'msk_refresh';

// URL do servidor — usado somente para o fetch de token em background
// (Google Calendar + E-mail SMTP precisam de JWT)
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  changePassword: (senhaAtual: string, novaSenha: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = SessionDB.get();
    if (saved) setUser(saved);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    // ── Etapa 1: autenticação local (instantânea, sem servidor) ──
    const { UsersDB } = await import('../data/db');
    const found = UsersDB.getByEmail(email.toLowerCase().trim());
    if (!found || found.senha !== senha) throw new Error('E-mail ou senha incorretos.');
    if (!found.ativo) throw new Error('Usuário inativo. Contate o administrador.');
    SessionDB.set(found);
    setUser(found);
    void auditoriaApi.log('login', 'usuario', found.id, found.email);

    // ── Etapa 2: atualizar estatísticas da licença desta máquina ──
    licenseApi.updateLoginStats();
    void licenseApi.fetchGeo();           // geolocalização via IP (uma vez)
    void licenseApi.reportToServer();     // heartbeat para o servidor (fire-and-forget)

    // ── Etapa 3: buscar JWT do servidor em background ─────────────
    // O Render free tier pode levar 30-60s para acordar — não bloqueamos
    // o login por isso. Quando o token chegar, Google Calendar e E-mail
    // passam a funcionar automaticamente sem novo login.
    fetch(`${API_BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.toLowerCase().trim(), senha }),
      signal:  AbortSignal.timeout(65_000), // cobre o cold-start do Render (~50s)
    })
      .then(res => res.ok ? res.json() : null)
      .then((data: { token?: string; refreshToken?: string } | null) => {
        if (!data) return;
        if (data.token)        sessionStorage.setItem(TOKEN_KEY, data.token);
        if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
      })
      .catch(() => { /* servidor indisponível — dados já estão locais */ });
  }, []);

  const logout = useCallback(() => {
    void auditoriaApi.log('logout', 'usuario', user?.id, user?.email);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    SessionDB.clear();
    setUser(null);
  }, [user]);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    SessionDB.set(updated);
    setUser(updated);
  }, [user]);

  const changePassword = useCallback(async (senhaAtual: string, novaSenha: string) => {
    const { UsersDB } = await import('../data/db');
    const found = user ? UsersDB.getById(user.id) : null;
    if (!found || found.senha !== senhaAtual) throw new Error('Senha atual incorreta.');
    UsersDB.update(found.id, { senha: novaSenha });
    void auditoriaApi.log('alterar-senha', 'usuario', user?.id, user?.email);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
