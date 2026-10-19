import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Muted, Screen } from '../../components/ui';
import { deletePottyLog, getPottyLogsSince, type PottyLog } from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { colors, space } from '../../lib/theme';

function sevenDaysAgo() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6);
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });
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

  function confirmDelete(log: PottyLog) {
    Alert.alert('Borrar registro', `¿Borrar el registro de las ${timeLabel(log.logged_at)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deletePottyLog(db, log.id);
          await load();
        },
      },
    ]);
  }

  const groups = new Map<string, PottyLog[]>();
  for (const l of logs) {
    const k = dayKey(l.logged_at);
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }

  return (
    <Screen title="Registro">
      <Muted>Últimos 7 días. Mantené presionado un registro para borrarlo.</Muted>
      {logs.length === 0 ? <Muted>Todavía no hay registros. Usá los botones de "Hoy".</Muted> : null}
      {[...groups.entries()].map(([day, items]) => (
        <Card key={day}>
          <Text style={styles.day}>{day}</Text>
          {items.map((l) => (
            <Pressable key={l.id} onLongPress={() => confirmDelete(l)} style={styles.item}>
              <Text style={styles.time}>{timeLabel(l.logged_at)}</Text>
              <Text style={styles.what}>
                {l.kind === 'pipi' ? '💧 Pipí' : '💩 Popó'} {l.place === 'fuera' ? 'afuera' : 'adentro'}
              </Text>
              <View style={[styles.dot, { backgroundColor: l.place === 'fuera' ? colors.green : colors.caramel }]} />
            </Pressable>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
  time: { width: 72, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  what: { flex: 1, fontSize: 16, color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
