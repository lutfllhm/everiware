import { create } from 'zustand';

// Helper baca/tulis localStorage manual
const STORAGE_KEY = 'iware-auth';

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
};

const saved = loadState();

const useAuthStore = create((set) => ({
  user: saved.user || null,
  token: saved.token || null,
  isAuthenticated: saved.isAuthenticated || false,

  setAuth: (user, token) => {
    const newState = { user, token, isAuthenticated: true };
    saveState(newState);
    set(newState);
  },

  updateUser: (user) => set((state) => {
    const newState = { ...state, user: { ...state.user, ...user } };
    saveState({ user: newState.user, token: newState.token, isAuthenticated: newState.isAuthenticated });
    return { user: newState.user };
  }),

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
