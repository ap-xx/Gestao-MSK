import { useState, useMemo } from 'react';

export function useSort<T extends Record<string, any>>(
  items: T[],
  defaultKey: keyof T,
  defaultDir: 'asc' | 'desc' = 'asc'
) {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);

  const sorted = useMemo(() => [...items].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = String(av).localeCompare(String(bv), 'pt-BR', { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  }), [items, sortKey, sortDir]);

  const toggle = (key: keyof T) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  return { sorted, sortKey, sortDir, toggle };
}
