import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Button, Card, Chip, H2, Muted, Screen } from '../../components/ui';
import { goalById, lessonById, personalize } from '../../content';
import { addSessionLog, getDoneItems, getSessionLogs, setItemDone, type SessionLog } from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { colors, radius, space } from '../../lib/theme';

const SESSION_SECONDS = 5 * 60;
const RATINGS = [
  { value: 1, label: '😣' },
  { value: 2, label: '😕' },
  { value: 3, label: '🙂' },
  { value: 4, label: '😀' },
  { value: 5, label: '🤩' },
];

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export default function Leccion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { dog } = useDog();
  const lesson = lessonById(id);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<SessionLog[]>([]);

  const load = useCallback(async () => {
    if (!dog || !lesson) return;
    const [items, logs] = await Promise.all([getDoneItems(db, dog.id), getSessionLogs(db, dog.id, lesson.id)]);
    setDone(items.has(lesson.id));
    setHistory(logs);
  }, [db, dog, lesson]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!dog || !lesson) {
    return (
      <Screen underHeader>
        <Muted>No encontramos esta lección.</Muted>
      </Screen>
    );
  }

  const goal = goalById(lesson.goal);
  const t = (text: string) => personalize(text, dog.name);

  async function toggleDone() {
    if (!dog || !lesson) return;
    await setItemDone(db, dog.id, lesson.id, !done);
    await load();
  }

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: goal ? `${goal.emoji} ${goal.name}` : '' }} />

      <View style={{ gap: space.xs }}>
        <Text style={styles.title}>{lesson.title}</Text>
        <Muted>{t(lesson.purpose)}</Muted>
      </View>

      {lesson.kind === 'practica' ? <SessionPanel dogId={dog.id} lessonId={lesson.id} onSaved={load} /> : null}

      <Card>
        <H2>Qué necesitás</H2>
        {lesson.needs.map((n) => (
          <Text key={n} style={styles.bullet}>
            • {t(n)}
          </Text>
        ))}
      </Card>

      <Card>
        <H2>Pasos</H2>
        {lesson.steps.map((s, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.stepText}>{t(s.text)}</Text>
              <Text style={styles.stepNext}>→ {t(s.next)}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <H2>Errores comunes</H2>
        {lesson.mistakes.map((m) => (
          <Text key={m} style={styles.bullet}>
            ✗ {t(m)}
          </Text>
        ))}
      </Card>

      {lesson.dachshund ? (
        <Card style={styles.dachshund}>
          <Text style={styles.bullet}>🌭 {t(lesson.dachshund)}</Text>
        </Card>
      ) : null}

      <Card style={done ? styles.doneCard : undefined}>
        <H2>{lesson.kind === 'practica' ? 'Logrado cuando…' : 'Listo cuando…'}</H2>
        <Text style={styles.stepText}>{t(lesson.doneWhen)}</Text>
        <Button
          label={done ? '✓ ¡Logrado! (tocá para deshacer)' : lesson.kind === 'practica' ? '¡Lo logramos!' : 'Marcar como leída'}
          variant={done ? 'secondary' : 'green'}
          onPress={toggleDone}
          big
        />
        {history.length > 0 ? (
          <Muted>
            {history.length} {history.length === 1 ? 'sesión' : 'sesiones'} · última {daysAgo(history[0].logged_at)}
          </Muted>
        ) : null}
      </Card>
    </Screen>
  );
}

/** Temporizador de 5 minutos, contador de repeticiones y "¿cómo te fue?". */
function SessionPanel({ dogId, lessonId, onSaved }: { dogId: number; lessonId: string; onSaved: () => void }) {
  const db = useSQLiteContext();
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [reps, setReps] = useState(0);
  const [finished, setFinished] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const vibrated = useRef(false);

  useEffect(() => {
    if (endsAt == null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !vibrated.current) {
        vibrated.current = true;
        Vibration.vibrate([0, 400, 200, 400]);
        setEndsAt(null);
        setFinished(true);
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [endsAt]);

  const running = endsAt != null;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');

  function start(fromSeconds = remaining) {
    vibrated.current = false;
    setSaved(false);
    setFinished(false);
    setRemaining(fromSeconds);
    setEndsAt(Date.now() + fromSeconds * 1000);
  }

  function pause() {
    setEndsAt(null);
  }

  async function save() {
    await addSessionLog(db, dogId, lessonId, reps || null, rating);
    setSaved(true);
    setFinished(false);
    setReps(0);
    setRating(null);
    setRemaining(SESSION_SECONDS);
    onSaved();
  }

  return (
    <Card style={styles.session}>
      <View style={styles.sessionRow}>
        <Text style={styles.timer}>
          {mm}:{ss}
        </Text>
        <View style={{ flex: 1 }}>
          {running ? (
            <Button label="Pausa" variant="secondary" onPress={pause} />
          ) : (
            <Button
              label={remaining === SESSION_SECONDS ? '▶ Empezar sesión' : remaining === 0 ? 'Otra vez' : '▶ Seguir'}
              onPress={() => start(remaining === 0 ? SESSION_SECONDS : remaining)}
            />
          )}
        </View>
      </View>

      <Pressable onPress={() => setReps(reps + 1)} style={styles.reps} accessibilityRole="button" accessibilityLabel="Sumar una repetición">
        <Text style={styles.repsValue}>{reps}</Text>
        <Text style={styles.repsLabel}>repeticiones · tocá para sumar</Text>
      </Pressable>

      {finished ? <Muted>¡Tiempo! Terminá con algo que le salga bien y un premio.</Muted> : null}

      {finished || (!running && (reps > 0 || remaining < SESSION_SECONDS)) ? (
        <View style={{ gap: space.sm }}>
          <Text style={styles.askLabel}>¿Cómo te fue?</Text>
          <View style={styles.ratings}>
            {RATINGS.map((r) => (
              <Chip key={r.value} label={r.label} selected={rating === r.value} onPress={() => setRating(r.value)} />
            ))}
          </View>
          <Button label="Guardar sesión" variant="green" onPress={save} />
        </View>
      ) : null}

      {saved ? <Muted>Sesión guardada. Si ya cumple el criterio de abajo, marcala como lograda.</Muted> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  bullet: { fontSize: 16, color: colors.text, lineHeight: 23 },
  step: { flexDirection: 'row', gap: space.md, paddingVertical: space.xs },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.caramel,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  stepText: { fontSize: 16, color: colors.text, lineHeight: 23 },
  stepNext: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  dachshund: { backgroundColor: colors.caramelSoft },
  doneCard: { borderColor: colors.green, borderWidth: 2, backgroundColor: colors.greenSoft },
  session: { borderColor: colors.caramel, borderWidth: 2 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  timer: { fontSize: 44, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'], minWidth: 120 },
  reps: { backgroundColor: colors.caramelSoft, borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center' },
  repsValue: { fontSize: 40, fontWeight: '800', color: colors.caramel },
  repsLabel: { fontSize: 14, color: colors.textMuted },
  askLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  ratings: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
