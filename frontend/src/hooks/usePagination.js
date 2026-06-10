import { useState, useMemo } from 'react';

/**
 * Hook pagination sederhana untuk data array di frontend.
 * @param {Array}  data      - array data yang akan dipaginasi
 * @param {number} pageSize  - jumlah item per halaman (default 20)
 */
export function usePagination(data = [], pageSize = 20) {
  const [page, setPage] = useState(1);

  // Reset ke halaman 1 saat data berubah (filter, search, dll)
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage   = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  const goTo   = (p) => setPage(Math.max(1, Math.min(p, totalPages)));
  const next   = () => goTo(safePage + 1);
  const prev   = () => goTo(safePage - 1);
  const reset  = () => setPage(1);

  return {
    paged,
    page: safePage,
    totalPages,
    total: data.length,
    pageSize,
    goTo,
    next,
    prev,
    reset,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
