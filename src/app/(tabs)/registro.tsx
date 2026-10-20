import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { LogRow, toEntries, type DayEntry } from '../../components/LogRow';
import { Card, Muted, Screen } from '../../components/ui';
import { deleteActivityLog, deletePottyLog, getActivityLogsSince, getPottyLogsSince } from '../../lib/db';
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
  const [entries, setEntries] = useState<DayEntry[]>([]);

  const load = useCallback(async () => {
    if (!dog) return;
    const [potty, activities] = await Promise.all([
      getPottyLogsSince(db, dog.id, sevenDaysAgo()),
      getActivityLogsSince(db, dog.id, sevenDaysAgo()),
    ]);
    setEntries(toEntries(potty, activities));
  }, [db, dog]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function remove(entry: DayEntry) {
    if (entry.type === 'potty') await deletePottyLog(db, entry.id);
    else await deleteActivityLog(db, entry.id);
    await load();
    await syncReminders(db);
  }

  const groups = new Map<string, DayEntry[]>();
  for (const e of entries) {
    const k = dayKey(e.at);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <Screen title="Registro">
      <Muted>Últimos 7 días: baño, comidas y siestas. Tocá 🗑 para borrar un registro equivocado.</Muted>
      {entries.length === 0 ? <Muted>Todavía no hay registros. Usá los botones de "Hoy".</Muted> : null}
      {[...groups.entries()].map(([day, items]) => (
        <Card key={day}>
          <Text style={styles.day}>{day}</Text>
          {items.map((e) => (
            <LogRow key={e.id} entry={e} onDelete={remove} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
});
