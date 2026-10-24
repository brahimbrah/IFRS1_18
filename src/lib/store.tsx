import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Dossier, User } from './types';

type Toast = { id: number; kind: 'info' | 'success' | 'error'; message: string };

type AppState = {
  user: User | null;
  loading: boolean;
  dossiers: Dossier[];
  current: Dossier | null;
  toasts: Toast[];
  refreshDossiers: () => Promise<Dossier[]>;
  selectDossier: (id: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  notify: (message: string, kind?: Toast['kind']) => void;
};

const Ctx = createContext<AppState | null>(null);

const CURRENT_KEY = 'ifrs.currentDossier';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => localStorage.getItem(CURRENT_KEY));
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const refreshDossiers = useCallback(async () => {
    const res = await api.get<{ dossiers: Dossier[] }>('/dossiers');
    setDossiers(res.dossiers);
    return res.dossiers;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get<{ user: User | null }>('/auth/me');
        setUser(me.user);
        if (me.user) await refreshDossiers();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshDossiers]);

  const selectDossier = useCallback((id: string | null) => {
    setCurrentId(id);
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else localStorage.removeItem(CURRENT_KEY);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ user: User }>('/auth/login', { email, password });
      setUser(res.user);
      await refreshDossiers();
    },
    [refreshDossiers],
  );

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      const res = await api.post<{ user: User }>('/auth/register', { email, name, password });
      setUser(res.user);
      await refreshDossiers();
    },
    [refreshDossiers],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
    setDossiers([]);
    selectDossier(null);
  }, [selectDossier]);

  const current = useMemo(() => dossiers.find((d) => d.id === currentId) ?? null, [dossiers, currentId]);

  const value: AppState = {
    user,
    loading,
    dossiers,
    current,
    toasts,
    refreshDossiers,
    selectDossier,
    login,
    register,
    logout,
    notify,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp doit être utilisé dans AppProvider');
  return ctx;
}
