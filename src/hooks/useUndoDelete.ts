import { useRef, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

/**
 * Returns a function that performs a "soft delete with undo".
 *
 * Pattern:
 *  1. Item is removed from the UI immediately (optimistic update via `onRemoveFromUI`).
 *  2. A toast appears: "X excluído [Desfazer]" with a 5-second countdown.
 *  3. If the user clicks Desfazer within 5 s → `onRestore` is called (item reappears).
 *  4. Otherwise → `onConfirmDelete` is called (permanent removal from storage).
 *
 * @param label     Human-readable label shown in the toast (e.g. "Cliente")
 */
export function useUndoDelete<T extends { id: string }>(label: string) {
  const { showToast } = useToast();
  // Tracks the pending-delete timeout handle so we can cancel it on undo
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deleteWithUndo = useCallback(
    (
      item: T,
      onRemoveFromUI:  (item: T) => void,
      onRestore:       (item: T) => void,
      onConfirmDelete: (item: T) => Promise<void>,
    ) => {
      // Cancel any previous pending delete
      if (timer.current) clearTimeout(timer.current);

      // 1. Remove from UI immediately
      onRemoveFromUI(item);

      let undone = false;

      // 2. Show undo toast
      showToast('info', `${label} excluído`, undefined, {
        label: 'Desfazer',
        onClick: () => {
          undone = true;
          if (timer.current) clearTimeout(timer.current);
          onRestore(item);
        },
      });

      // 3. After 5 s — permanently delete (unless undone)
      timer.current = setTimeout(() => {
        if (!undone) {
          onConfirmDelete(item).catch(() => {
            // If server delete fails, restore the item
            onRestore(item);
          });
        }
      }, 5_000);
    },
    [label, showToast],
  );

  return deleteWithUndo;
}
