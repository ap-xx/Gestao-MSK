import { useEffect } from 'react';
import { backupApi } from '../services/api';
import { useToast } from '../context/ToastContext';

export type BackupSchedule = 'desabilitado' | 'diario' | 'semanal' | 'mensal';
export type BackupMode = 'auto' | 'notificar';

export const BACKUP_SCHED_KEY = 'msk_backup_schedule';
export const BACKUP_LAST_KEY  = 'msk_backup_last';
export const BACKUP_MODE_KEY  = 'msk_backup_mode';
export const BACKUP_TIME_KEY  = 'msk_backup_time';  // 'HH:MM'
export const BACKUP_DOW_KEY   = 'msk_backup_dow';   // dia da semana 0–6
export const BACKUP_DOM_KEY   = 'msk_backup_dom';   // dia do mês 1–31

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
    function checkAndRun() {
      const schedule = (localStorage.getItem(BACKUP_SCHED_KEY) as BackupSchedule) || 'desabilitado';
      if (schedule === 'desabilitado') return;

      const mode     = (localStorage.getItem(BACKUP_MODE_KEY) as BackupMode) || 'auto';
      const last     = localStorage.getItem(BACKUP_LAST_KEY);
      const lastTime = last ? new Date(last).getTime() : 0;

      // Ainda dentro do período de threshold — não é hora de rodar
      if (Date.now() - lastTime < THRESHOLDS[schedule]) return;

      // Verificação de dia da semana (semanal) ou dia do mês (mensal)
      const now = new Date();
      if (schedule === 'semanal') {
        const dow = Number(localStorage.getItem(BACKUP_DOW_KEY) ?? '1');
        if (now.getDay() !== dow) return;
      }
      if (schedule === 'mensal') {
        const dom = Number(localStorage.getItem(BACKUP_DOM_KEY) ?? '1');
        if (now.getDate() !== dom) return;
      }

      // Verificação de horário do dia
      const [hStr = '8', mStr = '0'] = (localStorage.getItem(BACKUP_TIME_KEY) || '08:00').split(':');
      const scheduledMin = Number(hStr) * 60 + Number(mStr);
      if (now.getHours() * 60 + now.getMinutes() < scheduledMin) return;

      if (mode === 'auto') {
        triggerBackupDownload()
          .then(() => showToast('success', 'Backup automático realizado!'))
          .catch(() => showToast('error', 'Falha no backup automático'));
      } else {
        // Salva timestamp para não repetir o aviso no próximo tick do interval
        localStorage.setItem(BACKUP_LAST_KEY, new Date().toISOString());
        showToast(
          'info',
          'Backup pendente',
          'Acesse Configurações → Dados para baixar o backup.',
        );
      }
    }

    checkAndRun(); // verifica imediatamente ao abrir o app
    // Continua verificando a cada minuto enquanto o app estiver aberto
    const interval = setInterval(checkAndRun, 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
