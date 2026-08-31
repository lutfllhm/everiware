import { useEffect } from 'react';
import useAuthStore from '../../store/authStore';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

export default function RealtimeListener() {
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    let eventSource = null;
    let retryTimer = null;
    let retryCount = 0;
    let stopped = false;

    const connect = () => {
      const streamUrl = `/api/realtime/stream?token=${token}`;
      eventSource = new EventSource(streamUrl);

      const handleEvent = (event) => {
        try {
          const payload = JSON.parse(event.data);
          console.log(`🔌 Realtime event received (${event.type}):`, payload);

          if (event.type === 'attendance_update') {
            window.dispatchEvent(new CustomEvent('realtime-attendance', { detail: payload }));
          } else if (event.type === 'leave_update') {
            window.dispatchEvent(new CustomEvent('realtime-leave', { detail: payload }));
          } else if (event.type === 'overtime_update') {
            window.dispatchEvent(new CustomEvent('realtime-overtime', { detail: payload }));
          } else if (event.type === 'notification_update') {
            window.dispatchEvent(new CustomEvent('realtime-notification', { detail: payload }));
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };

      eventSource.addEventListener('attendance_update', handleEvent);
      eventSource.addEventListener('leave_update', handleEvent);
      eventSource.addEventListener('overtime_update', handleEvent);
      eventSource.addEventListener('notification_update', handleEvent);

      eventSource.onopen = () => {
        retryCount = 0;
      };

      eventSource.onerror = () => {
        // readyState CLOSED berarti browser tidak akan retry sendiri (mis. setelah 401/403).
        // readyState CONNECTING berarti browser sedang otomatis mencoba reconnect — kita
        // tetap ambil alih kontrolnya supaya bisa dibatasi jumlah percobaannya.
        eventSource.close();

        if (stopped) return;

        retryCount += 1;
        if (retryCount > MAX_RETRIES) {
          console.warn('Realtime SSE: berhenti mencoba setelah beberapa kali gagal (kemungkinan sesi tidak valid).');
          return;
        }

        console.warn(`Realtime SSE connection error, retry ${retryCount}/${MAX_RETRIES} dalam ${RETRY_DELAY_MS / 1000}s...`);
        retryTimer = setTimeout(connect, RETRY_DELAY_MS);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (eventSource) eventSource.close();
    };
  }, [isAuthenticated, token]);

  return null;
}
