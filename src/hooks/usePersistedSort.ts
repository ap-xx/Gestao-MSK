import { useMemo } from 'react';
import { usePersistedFilter } from './usePersistedFilter';

/**
 * Like `useSort`, but the current sort key and direction are persisted in
 * sessionStorage so they survive page navigation within the same tab.
 *
 * @param items         Array to sort
 * @param defaultKey    Column to sort by on first visit
 * @param storagePrefix Unique prefix for sessionStorage keys (e.g. "cli", "proc")
 * @param defaultDir    Initial sort direction
 */
export function usePersistedSort<T extends Record<string, any>>(
  items: T[],
  defaultKey: keyof T,
  storagePrefix: string,
  defaultDir: 'asc' | 'desc' = 'asc',
) {
  const [sortKey, setSortKey] = usePersistedFilter<keyof T>(
    `${storagePrefix}_sortkey`,
    defaultKey,
  );
  const [sortDir, setSortDir] = usePersistedFilter<'asc' | 'desc'>(
    `${storagePrefix}_sortdir`,
    defaultDir,
  );

  const toggle = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggle };
}
