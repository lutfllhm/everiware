import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let sessionExpiredHandled = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      if (!sessionExpiredHandled) {
        sessionExpiredHandled = true;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('iware-auth');
        toast.error('Sesi kamu telah berakhir. Silakan login kembali.');
        // Redirect halus via history API dulu; reload penuh sebagai fallback
        // supaya seluruh state aplikasi (store, query cache) ikut ter-reset bersih.
        setTimeout(() => {
          window.location.href = '/login';
        }, 800);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
