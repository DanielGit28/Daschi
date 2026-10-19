import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDog, type Dog } from './db';

type DogContextValue = {
  dog: Dog | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const DogContext = createContext<DogContextValue | null>(null);

export function DogProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [dog, setDog] = useState<Dog | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setDog(await getDog(db));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  return <DogContext.Provider value={{ dog, loading, reload }}>{children}</DogContext.Provider>;
}

export function useDog() {
  const ctx = useContext(DogContext);
  if (!ctx) throw new Error('useDog debe usarse dentro de <DogProvider>');
  return ctx;
}
