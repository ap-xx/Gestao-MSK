import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { SessionDB } from '../data/db';

const TOKEN_KEY = 'msk_token';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  changePassword: (senhaAtual: string, novaSenha: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

async function apiLogin(email: string, senha: string): Promise<{ token: string; user: User }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Erro ao autenticar.');
    return data as { token: string; user: User };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('O servidor está iniciando. Aguarde alguns instantes e tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = SessionDB.get();
    if (saved) setUser(saved);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    try {
      const { token, user: loggedUser } = await apiLogin(email.toLowerCase().trim(), senha);
      sessionStorage.setItem(TOKEN_KEY, token);
      SessionDB.set(loggedUser);
      setUser(loggedUser);
    } catch (err) {
      // Servidor não disponível — tenta autenticação local (fallback)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        const { UsersDB } = await import('../data/db');
        const found = UsersDB.getByEmail(email.toLowerCase().trim());
        if (!found || found.senha !== senha) throw new Error('E-mail ou senha incorretos.');
        if (!found.ativo) throw new Error('Usuário inativo. Contate o administrador.');
        SessionDB.set(found);
        setUser(found);
        return;
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    SessionDB.clear();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    SessionDB.set(updated);
    setUser(updated);
  }, [user]);

  const changePassword = useCallback(async (senhaAtual: string, novaSenha: string) => {
    const token = sessionStorage.getItem(TOKEN_KEY);

    if (token) {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao alterar senha.');
      return;
    }

    // Fallback local (servidor não disponível)
    const { UsersDB } = await import('../data/db');
    const found = user ? UsersDB.getById(user.id) : null;
    if (!found || found.senha !== senhaAtual) throw new Error('Senha atual incorreta.');
    UsersDB.update(found.id, { senha: novaSenha });
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
