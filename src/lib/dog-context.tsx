import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getAppState, getDogs, setAppState, type Dog } from './db';

type DogContextValue = {
  /** Mascota elegida en este dispositivo. */
  dog: Dog | null;
  dogs: Dog[];
  loading: boolean;
  reload: () => Promise<void>;
  /** Cambia la mascota elegida (null para volver a la pantalla de elegir). */
  selectDog: (id: string | null) => Promise<void>;
};

const DogContext = createContext<DogContextValue | null>(null);
const CURRENT_KEY = 'current_dog_id';

export function DogProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [list, current] = await Promise.all([getDogs(db), getAppState(db, CURRENT_KEY)]);
    setDogs(list);
    setCurrentId(current && list.some((d) => d.id === current) ? current : null);
    setLoading(false);
  }, [db]);

  const selectDog = useCallback(
    async (id: string | null) => {
      await setAppState(db, CURRENT_KEY, id);
      await reload();
    },
    [db, reload],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const dog = dogs.find((d) => d.id === currentId) ?? null;
  return <DogContext.Provider value={{ dog, dogs, loading, reload, selectDog }}>{children}</DogContext.Provider>;
}

export function useDog() {
  const ctx = useContext(DogContext);
  if (!ctx) throw new Error('useDog debe usarse dentro de <DogProvider>');
  return ctx;
}
