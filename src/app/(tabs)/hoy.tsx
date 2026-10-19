import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, H2, Muted, Screen } from '../../components/ui';
import { ageInWeeks, ageLabel, stageForWeeks } from '../../lib/age';
import { addPottyLog, getPottyLogsSince, type PottyKind, type PottyLog, type PottyPlace } from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { colors, radius, space } from '../../lib/theme';

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function minutesAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `hace ${h} h ${m} min` : `hace ${h} h`;
}

export default function Hoy() {
  const db = useSQLiteContext();
  const { dog } = useDog();
  const [logs, setLogs] = useState<PottyLog[]>([]);

  const load = useCallback(async () => {
    if (!dog) return;
    setLogs(await getPottyLogsSince(db, dog.id, startOfToday()));
  }, [db, dog]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!dog) return null;

  const weeks = ageInWeeks(dog.birth_date);
  const stage = stageForWeeks(weeks);
  const outside = logs.filter((l) => l.place === 'fuera').length;
  const inside = logs.filter((l) => l.place === 'dentro').length;
  const last = logs[0];

  async function log(kind: PottyKind, place: PottyPlace) {
    if (!dog) return;
    await addPottyLog(db, dog.id, kind, place);
    await load();
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

      <Card>
        <H2>Baño</H2>
        <Muted>
          {logs.length === 0
            ? 'Todavía no hay registros hoy.'
            : `Último: ${last.kind === 'pipi' ? 'pipí' : 'popó'} ${last.place} · ${minutesAgo(last.logged_at)}`}
        </Muted>
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
  stat: { flex: 1, borderWidth: 2, borderRadius: radius.sm, paddingVertical: space.sm, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 13, color: colors.textMuted },
});
