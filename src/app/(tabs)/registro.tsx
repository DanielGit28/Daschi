import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { PottyRow } from '../../components/PottyRow';
import { Card, Muted, Screen } from '../../components/ui';
import { deletePottyLog, getPottyLogsSince, type PottyLog } from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { syncReminders } from '../../lib/notifications';
import { colors } from '../../lib/theme';

function sevenDaysAgo() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6);
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Registro() {
  const db = useSQLiteContext();
  const { dog } = useDog();
  const [logs, setLogs] = useState<PottyLog[]>([]);

  const load = useCallback(async () => {
    if (!dog) return;
    setLogs(await getPottyLogsSince(db, dog.id, sevenDaysAgo()));
  }, [db, dog]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function remove(log: PottyLog) {
    await deletePottyLog(db, log.id);
    await load();
    await syncReminders(db);
  }

  const groups = new Map<string, PottyLog[]>();
  for (const l of logs) {
    const k = dayKey(l.logged_at);
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }

  return (
    <Screen title="Registro">
      <Muted>Últimos 7 días. Tocá 🗑 para borrar un registro equivocado.</Muted>
      {logs.length === 0 ? <Muted>Todavía no hay registros. Usá los botones de "Hoy".</Muted> : null}
      {[...groups.entries()].map(([day, items]) => (
        <Card key={day}>
          <Text style={styles.day}>{day}</Text>
          {items.map((l) => (
            <PottyRow key={l.id} log={l} onDelete={remove} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
});
