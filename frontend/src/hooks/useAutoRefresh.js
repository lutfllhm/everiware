import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook untuk auto-refresh data secara berkala (polling).
 *
 * @param {Function} fetchFn  - fungsi async yang dipanggil untuk fetch data
 * @param {number}   interval - interval dalam milidetik (default 60 detik, minimum 30 detik)
 * @param {boolean}  enabled  - aktifkan/nonaktifkan polling (default true)
 *
 * @returns {Function} refresh - fungsi untuk trigger refresh manual
 *
 * Fitur:
 * - Fetch langsung saat mount
 * - Polling otomatis setiap `interval` ms
 * - Pause saat tab tidak aktif (visibilitychange), resume saat aktif lagi
 * - Fetch ulang saat koneksi internet kembali (online event)
 * - Mencegah concurrent request (skip jika masih loading)
 * - Cleanup otomatis saat unmount
 */
export function useAutoRefresh(fetchFn, interval = 60_000, enabled = true) {
  const timerRef   = useRef(null);
  const fetchRef   = useRef(fetchFn);
  const loadingRef = useRef(false);

  // Minimum interval 30 detik untuk mencegah terlalu banyak request
  const safeInterval = Math.max(interval, 30_000);

  // Selalu pakai versi terbaru fetchFn tanpa restart timer
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  const safeFetch = useCallback(async () => {
    // Skip jika masih ada request yang berjalan
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      await fetchRef.current();
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      // Hanya fetch jika tab aktif
      if (document.visibilityState === 'visible') {
        safeFetch();
      }
    }, safeInterval);
  }, [safeInterval, safeFetch]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refresh = useCallback(() => {
    safeFetch();
  }, [safeFetch]);

  useEffect(() => {
    if (!enabled) return;

    // Fetch langsung saat mount
    safeFetch();

    // Mulai polling
    startPolling();

    // Pause saat tab tidak aktif, resume saat aktif
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        safeFetch(); // langsung fetch saat kembali aktif
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Fetch ulang saat koneksi internet kembali
    const handleOnline = () => {
      safeFetch();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, startPolling, stopPolling, safeFetch]);

  return refresh;
}
