import { useEffect } from 'react';
import useAuthStore from '../../store/authStore';

export default function RealtimeListener() {
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const streamUrl = `/api/realtime/stream?token=${token}`;
    const eventSource = new EventSource(streamUrl);

    const handleEvent = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log(`🔌 Realtime event received (${event.type}):`, payload);

        // Dispatch specific custom window events
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

    eventSource.onerror = (err) => {
      console.warn('Realtime SSE connection error, reconnecting...', err);
    };

    return () => {
      eventSource.close();
    };
  }, [isAuthenticated, token]);

  return null;
}
