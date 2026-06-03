import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { initializeDatabase, LicenseDB } from './data/db';
import { migrateFromLocalStorage } from './data/idb';
import { generateLicenseKey, validateLicenseKey } from './utils/license';
import Login from './pages/Login';
import LicenseGate from './components/LicenseGate';
import OAuthCallback from './pages/OAuthCallback';

// ── Bootstrap ─────────────────────────────────────────────────
const _hadData   = !!localStorage.getItem('msk_users');
const _gateShown = !!localStorage.getItem('msk_gate_shown');
initializeDatabase();
// One-time migration of existing localStorage data to IndexedDB
void migrateFromLocalStorage();
if (!LicenseDB.get() && _hadData && !_gateShown) {
  LicenseDB.set({
    machineId:   LicenseDB.getMachineId(),
    machineName: 'PC Registrado',
    licenseKey:  generateLicenseKey(),
    activatedAt: new Date().toISOString(),
    lastLogin:   new Date().toISOString(),
    loginCount:  0,
  });
}
// ──────────────────────────────────────────────────────────────

import Layout, { type PageKey } from './components/Layout';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useRecorrencia } from './hooks/useRecorrencia';
import { useState, useEffect, lazy, Suspense } from 'react';
import { canAccessPage } from './utils/permissions';

// ── Lazy-loaded pages ─────────────────────────────────────────
// Each page is split into its own chunk → faster initial load
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Clientes      = lazy(() => import('./pages/Clientes'));
const Contratos     = lazy(() => import('./pages/Contratos'));
const Processos     = lazy(() => import('./pages/Processos'));
const Honorarios    = lazy(() => import('./pages/Honorarios'));
const Previsao      = lazy(() => import('./pages/Previsao'));
const Inadimplencia = lazy(() => import('./pages/Inadimplencia'));
const Avisos        = lazy(() => import('./pages/Avisos'));
const Agenda        = lazy(() => import('./pages/Agenda'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Relatorios    = lazy(() => import('./pages/Relatorios'));
const Documentos    = lazy(() => import('./pages/Documentos'));
// Licenças removed from main app — managed via the standalone portal at /portal
// ──────────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
    </div>
  );
}

function AutoBackupChecker() {
  useAutoBackup();
  useRecorrencia();
  return null;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');

  // Redirect to dashboard if the user's role doesn't allow the current page
  useEffect(() => {
    if (user && !canAccessPage(user.role, currentPage)) {
      setCurrentPage('dashboard');
    }
  }, [user?.role, currentPage]);

  const [licensed, setLicensed] = useState<boolean>(
    () => validateLicenseKey(LicenseDB.get()?.licenseKey ?? '')
  );

  // Background server-side revocation check.
  // If server says key is revoked AND is reachable → clear local key, show gate.
  // If server is unreachable → keep offline-first behavior (no block).
  useEffect(() => {
    if (!licensed) return;
    const key = LicenseDB.get()?.licenseKey;
    if (!key) return;
    const RENDER_URL = 'https://gestao-msk.onrender.com/api';
    fetch(`${RENDER_URL}/licenses/validate?key=${encodeURIComponent(key)}`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then(r => r.json())
      .then((data: { valid: boolean; reason?: string }) => {
        if (data.valid === false) {
          // Key explicitly revoked by admin → clear local key and show gate
          LicenseDB.clear();
          localStorage.removeItem('msk_license');
          setLicensed(false);
        }
      })
      .catch(() => { /* server unreachable — keep offline access */ });
  }, [licensed]);

  if (!licensed) return <LicenseGate onActivated={() => setLicensed(true)} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-[#a0a0a0] text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const pages: Record<PageKey, React.ReactNode> = {
    dashboard:     <Dashboard />,
    clientes:      <Clientes />,
    contratos:     <Contratos />,
    processos:     <Processos />,
    honorarios:    <Honorarios />,
    previsao:      <Previsao />,
    agenda:        <Agenda />,
    inadimplencia: <Inadimplencia />,
    avisos:        <Avisos />,
    relatorios:    <Relatorios />,
    configuracoes: <Configuracoes />,
    documentos:    <Documentos />,
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      <AutoBackupChecker />
      <Suspense fallback={<PageLoader />}>
        {pages[currentPage]}
      </Suspense>
    </Layout>
  );
}

export default function App() {
  // Handle Google OAuth callback at /oauth/google without license gate
  if (window.location.pathname === '/oauth/google') {
    return <OAuthCallback />;
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
