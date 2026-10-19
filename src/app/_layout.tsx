import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { DATABASE_NAME, migrateDbIfNeeded } from '../lib/db';
import { DogProvider } from '../lib/dog-context';
import { syncReminders } from '../lib/notifications';
import { colors } from '../lib/theme';

// Los avisos de baño se programan para las próximas horas: al abrir o volver a la app se renuevan.
function ReminderSync() {
  const db = useSQLiteContext();
  useEffect(() => {
    syncReminders(db);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders(db);
    });
    return () => sub.remove();
  }, [db]);
  return null;
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <DogProvider>
        <ReminderSync />
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      </DogProvider>
    </SQLiteProvider>
  );
}
