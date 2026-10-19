import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PottyRow, pottyLabel } from '../../components/PottyRow';
import { Button, Card, H2, Muted, Screen } from '../../components/ui';
import { ageInWeeks, ageLabel, stageForWeeks } from '../../lib/age';
import {
  addPottyLog,
  deletePottyLog,
  getLastPottyLog,
  getPottyLogsSince,
  getReminders,
  type PottyKind,
  type PottyLog,
  type PottyPlace,
  type Reminder,
} from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { syncReminders } from '../../lib/notifications';
import { parseTime, pottyStatus } from '../../lib/schedule';
import { colors, radius, space } from '../../lib/theme';

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const UNDO_MS = 8000;

export default function Hoy() {
  const db = useSQLiteContext();
  const { dog } = useDog();
  const [logs, setLogs] = useState<PottyLog[]>([]);
  const [lastLog, setLastLog] = useState<PottyLog | null>(null);
  const [pottyReminder, setPottyReminder] = useState<Reminder | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Último toque, para poder deshacerlo durante unos segundos.
  const [undo, setUndo] = useState<{ id: number; label: string } | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const load = useCallback(async () => {
    if (!dog) return;
    const [today, last, reminders] = await Promise.all([
      getPottyLogsSince(db, dog.id, startOfToday()),
      getLastPottyLog(db, dog.id),
      getReminders(db, dog.id),
    ]);
    setLogs(today);
    setLastLog(last);
    setPottyReminder(reminders.find((r) => r.interval_min != null) ?? null);
    setNow(new Date());
  }, [db, dog]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Refrescar la cuenta regresiva mientras la pantalla está visible.
      const timer = setInterval(() => setNow(new Date()), 30_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  if (!dog) return null;

  const weeks = ageInWeeks(dog.birth_date);
  const stage = stageForWeeks(weeks);
  const outside = logs.filter((l) => l.place === 'fuera').length;
  const inside = logs.filter((l) => l.place === 'dentro').length;

  async function log(kind: PottyKind, place: PottyPlace) {
    if (!dog) return;
    const id = await addPottyLog(db, dog.id, kind, place);
    setUndo({ id, label: pottyLabel({ kind, place }) });
    await load();
    await syncReminders(db); // la próxima salida se cuenta desde este registro
  }

  async function remove(id: number) {
    setUndo(null);
    await deletePottyLog(db, id);
    await load();
    await syncReminders(db);
  }

  return (
    <Screen title={`Hoy con ${dog.name}`}>
      <Card style={styles.hero}>
        <Text style={styles.churro}>🌭</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.age}>{ageLabel(dog.birth_date)}</Text>
          <Muted>
            Etapa {stage.number} · {stage.name}
          </Muted>
        </View>
      </Card>

      <NextOuting reminder={pottyReminder} lastLog={lastLog} now={now} />

      <Card>
        <H2>Baño</H2>
        <View style={styles.row}>
          <Stat value={outside} label="afuera" color={colors.green} />
          <Stat value={inside} label="accidentes" color={colors.caramel} />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label="💧 Pipí afuera" variant="green" onPress={() => log('pipi', 'fuera')} big />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="💩 Popó afuera" variant="green" onPress={() => log('popo', 'fuera')} big />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label="Pipí adentro" variant="secondary" onPress={() => log('pipi', 'dentro')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Popó adentro" variant="secondary" onPress={() => log('popo', 'dentro')} />
          </View>
        </View>
        {undo ? (
          <View style={styles.undo}>
            <Text style={styles.undoText}>{undo.label} registrado</Text>
            <Pressable onPress={() => remove(undo.id)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.undoAction}>Deshacer</Text>
            </Pressable>
          </View>
        ) : null}
        {logs.length === 0 ? (
          <Muted>Todavía no hay registros hoy.</Muted>
        ) : (
          <View>
            {logs.map((l) => (
              <PottyRow key={l.id} log={l} onDelete={(x) => remove(x.id)} />
            ))}
          </View>
        )}
        {inside > 0 ? <Muted>Los accidentes son normales a esta edad. Limpiá con limpiador enzimático y seguí con la rutina.</Muted> : null}
      </Card>

      <Card>
        <H2>Lecciones de hoy</H2>
        <Muted>Foco de esta etapa: {stage.focus}.</Muted>
        <Muted>Las lecciones de 5 minutos aparecen aquí a partir del jueves.</Muted>
      </Card>
    </Screen>
  );
}

function NextOuting({ reminder, lastLog, now }: { reminder: Reminder | null; lastLog: PottyLog | null; now: Date }) {
  if (!reminder?.enabled || !reminder.interval_min) {
    return (
      <Pressable onPress={() => router.push('/recordatorios')}>
        <Card>
          <Muted>🔔 Activá el recordatorio de baño para que Dachsi te avise cuándo salir.</Muted>
        </Card>
      </Pressable>
    );
  }
  const quietEnd = parseTime(reminder.quiet_end);
  const { overdue, quiet, next } = pottyStatus({
    lastLog: lastLog ? new Date(lastLog.logged_at) : null,
    now,
    intervalMin: reminder.interval_min,
    quietStart: parseTime(reminder.quiet_start),
    quietEnd,
  });
  const clock = (d: Date) => d.toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });
  const inMin = next ? Math.max(0, Math.round((next.getTime() - now.getTime()) / 60000)) : null;

  let title: string;
  let detail: string;
  if (quiet) {
    title = '🌙 Silencio de noche';
    detail = `Avisos de nuevo a las ${reminder.quiet_end}.`;
  } else if (overdue) {
    title = '🚪 ¡Ya toca salir!';
    detail = 'Registrá la salida y el reloj vuelve a empezar.';
  } else {
    title = next ? `Próxima salida: ${clock(next)}` : 'Sin próxima salida';
    detail = inMin != null ? (inMin < 1 ? 'Ahora' : `En ${inMin < 60 ? `${inMin} min` : `${Math.floor(inMin / 60)} h ${inMin % 60} min`}`) : '';
  }

  return (
    <Card style={overdue ? styles.overdue : undefined}>
      <Text style={styles.nextTitle}>{title}</Text>
      <Muted>{detail}</Muted>
    </Card>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[styles.stat, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.caramelSoft },
  churro: { fontSize: 44 },
  age: { fontSize: 20, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: space.sm },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  undoText: { color: '#FFFFFF', fontSize: 15, flex: 1 },
  undoAction: { color: colors.caramelSoft, fontSize: 15, fontWeight: '800' },
  overdue: { backgroundColor: colors.caramelSoft, borderColor: colors.caramel, borderWidth: 2 },
  nextTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  stat: { flex: 1, borderWidth: 2, borderRadius: radius.sm, paddingVertical: space.sm, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 13, color: colors.textMuted },
});
