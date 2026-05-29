import { useEffect } from 'react';

/**
 * Fires `onSave` whenever the user presses Ctrl+S (or Cmd+S on Mac).
 * Prevents the browser's default "Save page" dialog.
 *
 * @param onSave   Callback to invoke on save shortcut
 * @param enabled  Set to false to disable (e.g. while the modal is closed)
 */
export function useCtrlSave(onSave: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave, enabled]);
}
