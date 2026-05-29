import { useState, useCallback } from 'react';

/**
 * Like useState, but the value is persisted in sessionStorage so it survives
 * navigation between pages within the same tab.
 *
 * @param storageKey  Unique key in sessionStorage (e.g. "filter_clientes_search")
 * @param defaultValue  Initial value when nothing is stored yet
 */
export function usePersistedFilter<T>(
  storageKey: string,
  defaultValue: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValueState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValueState(prev => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(next));
        } catch { /* quota exceeded — silently skip */ }
        return next;
      });
    },
    [storageKey],
  );

  return [value, setValue];
}
