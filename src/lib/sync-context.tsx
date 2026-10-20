import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { onLocalChange } from './changes';
import { useDog } from './dog-context';
import { syncReminders } from './notifications';
import { syncAll } from './sync';

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

type SyncContextValue = {
  status: SyncStatus;
  lastSyncAt: Date | null;
  error: string | null;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const DEBOUNCE_MS = 1500;
const INTERVAL_MS = 2 * 60 * 1000;

/** Sincroniza al abrir, al volver a la app, después de cada cambio local y cada 2 minutos. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { reload } = useDog();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const again = useRef(false);

  const syncNow = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      do {
        again.current = false;
        const applied = await syncAll(db);
        if (applied > 0) {
          // Llegaron cambios de otro dispositivo: refrescar pantallas y reprogramar avisos.
          await reload();
          await syncReminders(db);
        }
      } while (again.current);
      setStatus('ok');
      setError(null);
      setLastSyncAt(new Date());
    } catch (e) {
      // Sin conexión o servidor caído: los datos siguen guardados localmente y se reintenta luego.
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      running.current = false;
    }
  }, [db, reload]);

  useEffect(() => {
    syncNow();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const offChange = onLocalChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(syncNow, DEBOUNCE_MS);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNow();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') syncNow();
    }, INTERVAL_MS);
    return () => {
      if (timer) clearTimeout(timer);
      offChange();
      appState.remove();
      clearInterval(interval);
    };
  }, [syncNow]);

  return <SyncContext.Provider value={{ status, lastSyncAt, error, syncNow }}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync debe usarse dentro de <SyncProvider>');
  return ctx;
}
