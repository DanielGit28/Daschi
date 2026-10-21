import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H2, Muted, ProgressBar, Screen } from '../../components/ui';
import { CONTENT, type Goal } from '../../content';
import { STAGES, stageForWeeks } from '../../lib/age';
import { useDog } from '../../lib/dog-context';
import { activeGoals, nextLesson, routeLessons, type GoalReason } from '../../lib/plan';
import { colors, radius, space } from '../../lib/theme';
import { usePlan, type PlanState } from '../../lib/use-plan';

const REASON_LABEL: Record<GoalReason, string> = { edad: 'Por su edad', raza: 'Por su raza', elegido: 'Elegido' };

export default function Aprender() {
  const { dog } = useDog();
  const { state } = usePlan(dog);
  if (!dog || !state) return null;

  const { profile } = state;
  const current = stageForWeeks(profile.weeks);
  const active = activeGoals(profile, CONTENT.goals);
  const activeIds = new Set(active.map((a) => a.goal.id));
  const others = CONTENT.goals.filter((g) => !activeIds.has(g.id));

  return (
    <Screen title="Aprender">
      <Card style={styles.stage}>
        <Text style={styles.stageName}>
          Etapa {current.number} · {current.name}
        </Text>
        <Muted>{current.focus}.</Muted>
      </Card>

      <Pressable onPress={() => router.push('/progreso')} accessibilityRole="button">
        <Card>
          <View style={styles.goalHeader}>
            <Text style={styles.goalName}>{state.level ? `${state.level.emoji} Nivel ${state.level.name}` : '🌱 Primer nivel en camino'}</Text>
            <Text style={styles.badge}>🔥 {state.streak}</Text>
          </View>
          <Muted>Ver progreso y lo que falta para el siguiente nivel ›</Muted>
        </Card>
      </Pressable>

      <View style={styles.sectionHeader}>
        <H2>Tus enfoques</H2>
        <Pressable onPress={() => router.push('/enfoques?editar=1')} hitSlop={10}>
          <Text style={styles.link}>Cambiar</Text>
        </Pressable>
      </View>
      {active.map(({ goal, reason }) => (
        <GoalCard key={goal.id} goal={goal} state={state} badge={REASON_LABEL[reason]} />
      ))}

      {others.length > 0 ? (
        <>
          <H2>Otros enfoques</H2>
          <Muted>Podés explorarlos aunque no estén en tu plan.</Muted>
          {others.map((goal) => (
            <GoalCard key={goal.id} goal={goal} state={state} />
          ))}
        </>
      ) : null}

      <H2>Etapas por edad</H2>
      {STAGES.map((s) => (
        <View key={s.number} style={[styles.stageRow, s.number === current.number && styles.stageRowActive]}>
          <Text style={styles.stageRowName}>
            {s.number}. {s.name}
          </Text>
          <Muted>{s.range}</Muted>
        </View>
      ))}

      <Button label="Cambiar enfoques" variant="secondary" onPress={() => router.push('/enfoques?editar=1')} />
    </Screen>
  );
}

function GoalCard({ goal, state, badge }: { goal: Goal; state: PlanState; badge?: string }) {
  const lessons = routeLessons(goal.id, CONTENT.lessons);
  const achieved = lessons.filter((l) => state.progress.achieved.has(l.id)).length;
  const next = nextLesson(goal.id, state.profile.weeks, state.progress, CONTENT.lessons);

  return (
    <Pressable onPress={() => router.push(`/ruta/${goal.id}`)}>
      <Card>
        <View style={styles.goalHeader}>
          <Text style={styles.goalName}>
            {goal.emoji} {goal.name}
          </Text>
          {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        </View>
        <ProgressBar value={achieved} max={lessons.length} />
        <Muted>
          {achieved}/{lessons.length} logradas{next ? ` · Sigue: ${next.title}` : achieved === lessons.length ? ' · ¡Ruta completa!' : ''}
        </Muted>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  stageName: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 16, fontWeight: '700', color: colors.accent },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  goalName: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  badge: {
    backgroundColor: colors.successSoft,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between', padding: space.sm, borderRadius: radius.sm },
  stageRowActive: { backgroundColor: colors.accentSoft },
  stageRowName: { fontSize: 15, color: colors.text, fontWeight: '600' },
});
