import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], pageSize = 15) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = useMemo(
    () => items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [items, safePage, pageSize]
  );

  return {
    items: paged,
    page: safePage,
    totalPages,
    total: items.length,
    setPage,
    hasNext: safePage < totalPages - 1,
    hasPrev: safePage > 0,
    next: () => setPage(p => Math.min(p + 1, totalPages - 1)),
    prev: () => setPage(p => Math.max(p - 1, 0)),
  };
}
