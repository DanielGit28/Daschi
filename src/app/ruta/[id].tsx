import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, H2, Muted, ProgressBar, Screen } from '../../components/ui';
import { CONTENT, goalById, lessonById, personalize, type GoalId } from '../../content';
import { useDog } from '../../lib/dog-context';
import { goalTips, isLessonAvailable, routeLessons } from '../../lib/plan';
import { colors, space } from '../../lib/theme';
import { usePlan } from '../../lib/use-plan';

export default function Ruta() {
  const { id } = useLocalSearchParams<{ id: GoalId }>();
  const { dog } = useDog();
  const { state } = usePlan(dog);
  const goal = goalById(id);

  if (!dog || !goal) {
    return (
      <Screen underHeader>
        <Muted>No encontramos este enfoque.</Muted>
      </Screen>
    );
  }
  if (!state) return <Screen underHeader>{null}</Screen>;

  const { profile, progress } = state;
  const lessons = routeLessons(goal.id, CONTENT.lessons);
  const achieved = lessons.filter((l) => progress.achieved.has(l.id)).length;
  const tips = goalTips(goal.id, profile, CONTENT.tips);
  const t = (text: string) => personalize(text, dog.name);

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: space.xs }}>
        <Text style={styles.title}>
          {goal.emoji} {goal.name}
        </Text>
        <Muted>{t(goal.summary)}</Muted>
      </View>

      <Card>
        <View style={styles.header}>
          <H2>Lista para seguir</H2>
          <Text style={styles.count}>
            {achieved}/{lessons.length}
          </Text>
        </View>
        <ProgressBar value={achieved} max={lessons.length} />
        {lessons.map((l) => {
          const done = progress.achieved.has(l.id);
          const available = isLessonAvailable(l, profile.weeks, progress.achieved);
          let status = l.kind === 'guia' ? 'Guía para leer' : 'Práctica de 5 min';
          if (!done && !available) {
            if (profile.weeks < l.minWeeks) status = `Desde las ${l.minWeeks} semanas`;
            else if (l.maxWeeks != null && profile.weeks >= l.maxWeeks) status = 'Su ventana ideal ya pasó, igual sirve repasarla';
            else if (l.after) status = `Después de "${lessonById(l.after)?.title ?? l.after}"`;
          }
          return (
            <Pressable key={l.id} onPress={() => router.push(`/leccion/${l.id}`)} style={styles.row}>
              <Text style={styles.icon}>{done ? '✅' : available ? '▶️' : '🔒'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.lessonTitle, done && styles.lessonDone]}>{l.title}</Text>
                <Text style={styles.status}>{done ? t(l.doneWhen) : status}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </Card>

      {goal.id === 'socializacion' ? (
        <Card>
          <H2>Lista de socialización</H2>
          <Muted>
            {state.socialCovered.size} de {CONTENT.socialization.length} cosas con una experiencia buena.
          </Muted>
          <ProgressBar value={state.socialCovered.size} max={CONTENT.socialization.length} />
          <Button label="Abrir lista" variant="secondary" onPress={() => router.push('/socializacion')} />
        </Card>
      ) : null}

      {tips.length > 0 ? (
        <Card>
          <H2>Consejos</H2>
          {tips.map((tip) => (
            <Text key={tip.id} style={styles.tip}>
              💡 {t(tip.text)}
            </Text>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 16, fontWeight: '700', color: colors.success },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  icon: { fontSize: 20, width: 28, textAlign: 'center' },
  lessonTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  lessonDone: { color: colors.textMuted },
  status: { fontSize: 14, color: colors.textMuted, lineHeight: 19 },
  chevron: { fontSize: 24, color: colors.textMuted },
  tip: { fontSize: 15, color: colors.text, lineHeight: 22 },
});
