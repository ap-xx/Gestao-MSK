import { useEffect } from 'react';
import { backupApi } from '../services/api';
import { useToast } from '../context/ToastContext';

export type BackupSchedule = 'desabilitado' | 'diario' | 'semanal' | 'mensal';
export type BackupMode = 'auto' | 'notificar';

export const BACKUP_SCHED_KEY = 'msk_backup_schedule';
export const BACKUP_LAST_KEY  = 'msk_backup_last';
export const BACKUP_MODE_KEY  = 'msk_backup_mode';

export const THRESHOLDS: Record<BackupSchedule, number> = {
  desabilitado: Infinity,
  diario:  1 * 24 * 60 * 60 * 1000,
  semanal: 7 * 24 * 60 * 60 * 1000,
  mensal:  30 * 24 * 60 * 60 * 1000,
};

/** Gera e dispara o download do arquivo de backup. Salva timestamp no localStorage. */
export async function triggerBackupDownload(): Promise<void> {
  const data = await backupApi.exportar();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `msk-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(BACKUP_LAST_KEY, new Date().toISOString());
}

/**
 * Roda uma vez ao montar (app start).
 * - modo 'auto'      → baixa o arquivo silenciosamente quando vencido.
 * - modo 'notificar' → mostra um toast pedindo para o usuário fazer o backup manualmente.
 */
export function useAutoBackup() {
  const { showToast } = useToast();

  useEffect(() => {
    const schedule = (localStorage.getItem(BACKUP_SCHED_KEY) as BackupSchedule) || 'desabilitado';
    if (schedule === 'desabilitado') return;

    const mode     = (localStorage.getItem(BACKUP_MODE_KEY) as BackupMode) || 'auto';
    const last     = localStorage.getItem(BACKUP_LAST_KEY);
    const lastTime = last ? new Date(last).getTime() : 0;

    if (Date.now() - lastTime < THRESHOLDS[schedule]) return;

    if (mode === 'auto') {
      triggerBackupDownload()
        .then(() => showToast('success', 'Backup automático realizado!'))
        .catch(() => showToast('error', 'Falha no backup automático'));
    } else {
      // Notifica sem baixar — o usuário decide quando fazer
      showToast(
        'info',
        'Backup pendente',
        'Acesse Configurações → Dados para baixar o backup.',
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
