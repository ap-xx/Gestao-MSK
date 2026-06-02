import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { SessionDB } from '../data/db';
import { auditoriaApi, licenseApi } from '../services/api';

const TOKEN_KEY   = 'msk_token';
const REFRESH_KEY = 'msk_refresh';

// URL do servidor — usado somente para o fetch de token em background
// (Google Calendar + E-mail SMTP precisam de JWT)
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

/** Thrown by login() when the server requires a TOTP code to continue */
export class Requires2FAError extends Error {
  readonly code = 'requires_2fa';
  constructor(public readonly userId: string) {
    super('Autenticação em dois fatores obrigatória.');
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  loginWith2FA: (userId: string, totp: string) => Promise<void>;
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
    const { UsersDB } = await import('../data/db');
    const normalEmail = email.toLowerCase().trim();
    const found = UsersDB.getByEmail(normalEmail);
    if (!found || found.senha !== senha) throw new Error('E-mail ou senha incorretos.');
    if (!found.ativo) throw new Error('Usuário inativo. Contate o administrador.');

    // ── Se o usuário tem 2FA habilitado localmente, exige código antes de prosseguir
    if (found.totpEnabled) {
      // Confirm with server (server has the real TOTP secret)
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalEmail, senha }),
        signal: AbortSignal.timeout(65_000),
      }).catch(() => null);

      if (!res) throw new Error('Servidor indisponível. Com 2FA ativo, é necessária conexão ao servidor.');
      const data = await res.json();
      if (data.requires2fa) throw new Requires2FAError(data.userId);
      // If server says no 2FA (race condition), continue normally
    }

    // ── Login local imediato ──────────────────────────────────────
    SessionDB.set(found);
    setUser(found);
    void auditoriaApi.log('login', 'usuario', found.id, found.email);

    licenseApi.updateLoginStats();
    void licenseApi.fetchGeo();
    void licenseApi.reportToServer();

    // ── JWT do servidor em background (se não necessitou 2FA) ─────
    fetch(`${API_BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: normalEmail, senha }),
      signal:  AbortSignal.timeout(65_000),
    })
      .then(res => res.ok ? res.json() : null)
      .then(async (data: { token?: string; refreshToken?: string; totpEnabled?: boolean } | null) => {
        if (!data) return;
        if (data.token)        sessionStorage.setItem(TOKEN_KEY, data.token);
        if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
        // Sync totpEnabled from server to local user
        // Fix: use dynamic import (no require() in ESM/browser) and update via
        // SessionDB + setUser directly to avoid stale closure on updateUser.
        if (data.totpEnabled !== undefined) {
          const { UsersDB: DB } = await import('../data/db');
          DB.update(found.id, { totpEnabled: data.totpEnabled });
          const current = SessionDB.get();
          if (current) {
            const updated = { ...current, totpEnabled: data.totpEnabled };
            SessionDB.set(updated);
            setUser(updated);
          }
        }
      })
      .catch(() => {});
  }, []);

  const loginWith2FA = useCallback(async (userId: string, totp: string) => {
    const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, totp }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Código inválido.');

    // Save JWT
    if (data.token)        sessionStorage.setItem(TOKEN_KEY, data.token);
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);

    // Complete local login
    const { UsersDB } = await import('../data/db');
    const found = UsersDB.getById(userId);
    if (!found) throw new Error('Usuário não encontrado localmente.');
    SessionDB.set({ ...found, totpEnabled: true });
    setUser({ ...found, totpEnabled: true });
    void auditoriaApi.log('login', 'usuario', found.id, found.email);
    licenseApi.updateLoginStats();
    void licenseApi.reportToServer();
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
    <AuthContext.Provider value={{ user, loading, login, loginWith2FA, logout, updateUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
