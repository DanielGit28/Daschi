import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Muted, ProgressBar, Screen } from '../components/ui';
import { CONTENT, type GoalId, type Household, type PottySpot } from '../content';
import { ageInWeeks, formatHumanDate, parseHumanDate } from '../lib/age';
import { getDogGoals, saveDogSetup } from '../lib/db';
import { useDog } from '../lib/dog-context';
import { automaticReason, dayKey } from '../lib/plan';
import { colors, radius, space } from '../lib/theme';

const MAX_GOALS = 3;
const STEPS = 5;

type Option<T> = { value: T; emoji: string; title: string; detail?: string };

const MINUTES: Option<number>[] = [
  { value: 5, emoji: '⏱️', title: '5 minutos', detail: '1 lección al día' },
  { value: 10, emoji: '⏱️', title: '10 minutos', detail: '2 lecciones al día' },
  { value: 15, emoji: '⏱️', title: '15 minutos o más', detail: '3 lecciones al día' },
];

const SPOTS: Option<PottySpot>[] = [
  { value: 'patio', emoji: '🌿', title: 'Patio o jardín' },
  { value: 'calle', emoji: '🚶', title: 'Calle, con correa' },
  { value: 'empapador', emoji: '🧻', title: 'Empapador o terraza' },
];

const HOUSEHOLDS: Option<Household>[] = [
  { value: 'solo', emoji: '🙋', title: 'Solo yo' },
  { value: 'familia', emoji: '👫', title: 'Pareja o familia', detail: 'Vamos a acordar las mismas señales' },
  { value: 'ninos', emoji: '🧒', title: 'Hay niños en casa', detail: 'Incluye consejos para jugar seguros' },
];

export default function Enfoques() {
  const db = useSQLiteContext();
  const { dog, reload } = useDog();
  const { editar } = useLocalSearchParams<{ editar?: string }>();
  const today = dayKey(new Date());

  const [step, setStep] = useState(0);
  const [atHome, setAtHome] = useState<boolean | null>(null);
  const [arrivalText, setArrivalText] = useState('');
  const [goals, setGoals] = useState<GoalId[]>([]);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [spot, setSpot] = useState<PottySpot | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Al editar, arrancar con las respuestas anteriores.
  useEffect(() => {
    if (!dog) return;
    if (dog.arrival_date) {
      const future = dog.arrival_date > today;
      setAtHome(!future);
      if (future) setArrivalText(formatHumanDate(dog.arrival_date));
    }
    setMinutes(dog.daily_minutes);
    setSpot(dog.potty_spot);
    setHousehold(dog.household);
    getDogGoals(db, dog.id).then(setGoals);
  }, [db, dog, today]);

  if (!dog) return null;
  const name = dog.name;
  const weeks = ageInWeeks(dog.birth_date);
  const automatic = CONTENT.goals
    .map((g) => ({ goal: g, reason: automaticReason(g, weeks, dog.breed) }))
    .filter((x) => x.reason);
  const choosable = CONTENT.goals.filter((g) => !automaticReason(g, weeks, dog.breed));

  function toggleGoal(id: GoalId) {
    setError(null);
    if (goals.includes(id)) setGoals(goals.filter((g) => g !== id));
    else if (goals.length >= MAX_GOALS) setError(`Elegí hasta ${MAX_GOALS} para empezar. Podés cambiarlos cuando quieras.`);
    else setGoals([...goals, id]);
  }

  /** Valida el paso actual; devuelve la fecha de llegada en el paso 0. */
  function validate(): string | null | false {
    setError(null);
    if (step === 0) {
      if (atHome === null) return fail('Elegí una opción.');
      if (atHome) return dog!.arrival_date && dog!.arrival_date <= today ? dog!.arrival_date : today;
      const iso = parseHumanDate(arrivalText);
      if (!iso) return fail('La fecha va como DD/MM/AAAA, por ejemplo 25/10/2026.');
      if (iso < today) return fail('Esa fecha ya pasó: elegí "Ya está en casa".');
      return iso;
    }
    if (step === 1 && goals.length === 0) return fail('Elegí al menos un enfoque.');
    if (step === 2 && minutes === null) return fail('Elegí cuánto tiempo tenés.');
    if (step === 3 && spot === null) return fail('Elegí dónde hace sus necesidades.');
    if (step === 4 && household === null) return fail('Elegí una opción.');
    return null;
  }

  function fail(message: string): false {
    setError(message);
    return false;
  }

  async function next() {
    const result = validate();
    if (result === false) return;
    if (step < STEPS - 1) return setStep(step + 1);

    const arrivalIso = atHome ? (dog!.arrival_date && dog!.arrival_date <= today ? dog!.arrival_date : today) : parseHumanDate(arrivalText)!;
    setSaving(true);
    try {
      await saveDogSetup(db, dog!.id, {
        arrival_date: arrivalIso,
        potty_spot: spot!,
        daily_minutes: minutes!,
        household: household!,
        goals,
      });
      await reload();
      if (editar) router.back();
      else router.replace('/hoy');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.top}>
        <ProgressBar value={step + 1} max={STEPS} color={colors.accent} />
        <Text style={styles.stepLabel}>
          {step + 1} de {STEPS}
        </Text>
      </View>

      {step === 0 ? (
        <>
          <Question title={`¿${name} ya está en casa?`} hint="Si todavía no llegó, te armamos la lista para preparar todo." />
          <OptionCard emoji="🏡" title="Ya está en casa" selected={atHome === true} onPress={() => setAtHome(true)} />
          <OptionCard emoji="📅" title="Llega pronto" selected={atHome === false} onPress={() => setAtHome(false)} />
          {atHome === false ? (
            <TextInput placeholderTextColor={colors.textMuted} keyboardAppearance="dark"
              style={styles.input}
              value={arrivalText}
              onChangeText={setArrivalText}
              placeholder="Fecha de llegada, ej. 25/10/2026"
              keyboardType="numbers-and-punctuation"
            />
          ) : null}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Question title="¿Qué querés trabajar primero?" hint={`Elegí hasta ${MAX_GOALS}. Siempre se pueden cambiar.`} />
          {automatic.length > 0 ? (
            <View style={styles.auto}>
              <Text style={styles.autoTitle}>Ya incluidos por su {automatic.some((a) => a.reason === 'edad') ? 'edad' : 'raza'}</Text>
              <Text style={styles.autoList}>{automatic.map((a) => `${a.goal.emoji} ${a.goal.name}`).join('   ')}</Text>
            </View>
          ) : null}
          {choosable.map((g) => (
            <OptionCard key={g.id} emoji={g.emoji} title={g.name} detail={g.summary} selected={goals.includes(g.id)} onPress={() => toggleGoal(g.id)} />
          ))}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Question title="¿Cuánto tiempo tenés para entrenar al día?" hint="Sesiones cortas funcionan mejor: 5 minutos, varias veces." />
          {MINUTES.map((o) => (
            <OptionCard key={o.value} {...o} selected={minutes === o.value} onPress={() => setMinutes(o.value)} />
          ))}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Question title={`¿Dónde va a hacer sus necesidades ${name}?`} hint="Cambia los consejos de baño." />
          {SPOTS.map((o) => (
            <OptionCard key={o.value} {...o} selected={spot === o.value} onPress={() => setSpot(o.value)} />
          ))}
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Question title={`¿Quiénes van a entrenar a ${name}?`} />
          {HOUSEHOLDS.map((o) => (
            <OptionCard key={o.value} {...o} selected={household === o.value} onPress={() => setHousehold(o.value)} />
          ))}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.nav}>
        {step > 0 || editar ? (
          <View style={{ flex: 1 }}>
            <Button label={step > 0 ? 'Atrás' : 'Cancelar'} variant="secondary" onPress={() => (step > 0 ? setStep(step - 1) : router.back())} big />
          </View>
        ) : null}
        <View style={{ flex: 2 }}>
          <Button label={step < STEPS - 1 ? 'Siguiente' : saving ? 'Guardando…' : '¡Listo!'} onPress={next} disabled={saving} big />
        </View>
      </View>
    </Screen>
  );
}

function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.question}>{title}</Text>
      {hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

function OptionCard({ emoji, title, detail, selected, onPress }: { emoji: string; title: string; detail?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
      </View>
      {selected ? <Text style={styles.optionCheck}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { gap: space.xs, marginTop: space.sm },
  stepLabel: { fontSize: 13, color: colors.textMuted, textAlign: 'right' },
  question: { fontSize: 26, fontWeight: '800', color: colors.text },
  auto: { backgroundColor: colors.successSoft, borderRadius: radius.sm, padding: space.md, gap: space.xs },
  autoTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  autoList: { fontSize: 15, color: colors.text, lineHeight: 22 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionEmoji: { fontSize: 28 },
  optionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  optionDetail: { fontSize: 14, color: colors.textMuted, lineHeight: 19 },
  optionCheck: { fontSize: 20, fontWeight: '800', color: colors.accent },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 15 },
  nav: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
