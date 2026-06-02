import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode   = 'dark' | 'light';
export type AccentColor = 'amber' | 'blue' | 'green' | 'purple' | 'pink';

export const ACCENT_OPTIONS: Array<{ key: AccentColor; label: string; hex: string }> = [
  { key: 'amber',  label: 'Âmbar',  hex: '#f59e0b' },
  { key: 'blue',   label: 'Azul',   hex: '#3b82f6' },
  { key: 'green',  label: 'Verde',  hex: '#22c55e' },
  { key: 'purple', label: 'Roxo',   hex: '#a855f7' },
  { key: 'pink',   label: 'Rosa',   hex: '#ec4899' },
];

const THEME_KEY  = 'msk_theme';
const ACCENT_KEY = 'msk_accent';

interface ThemeContextType {
  theme:     ThemeMode;
  accent:    AccentColor;
  setTheme:  (t: ThemeMode)   => void;
  setAccent: (a: AccentColor) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,  setThemeState]  = useState<ThemeMode>(
    () => (localStorage.getItem(THEME_KEY)  as ThemeMode)  || 'dark',
  );
  const [accent, setAccentState] = useState<AccentColor>(
    () => (localStorage.getItem(ACCENT_KEY) as AccentColor) || 'amber',
  );

  // Apply data attributes to <html> whenever they change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme',  theme);
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem(THEME_KEY,  theme);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [theme, accent]);

  // Apply on first render (before React hydration)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme',  theme);
    document.documentElement.setAttribute('data-accent', accent);
  }, []);

  const setTheme  = (t: ThemeMode)   => setThemeState(t);
  const setAccent = (a: AccentColor) => setAccentState(a);
  const toggleTheme = () => setThemeState(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
