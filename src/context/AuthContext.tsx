import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { UsersDB, SessionDB } from '../data/db';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = SessionDB.get();
    if (saved) setUser(saved);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const found = UsersDB.getByEmail(email.toLowerCase().trim());
    if (!found || found.senha !== senha) {
      throw new Error('E-mail ou senha incorretos.');
    }
    if (!found.ativo) {
      throw new Error('Usuário inativo. Contate o administrador.');
    }
    SessionDB.set(found);
    setUser(found);
  }, []);

  const logout = useCallback(() => {
    SessionDB.clear();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    UsersDB.update(user.id, updates);
    SessionDB.set(updated);
    setUser(updated);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
