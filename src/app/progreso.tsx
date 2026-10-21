import { Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LevelUp } from '../components/LevelUp';
import { Mascot, Spots } from '../components/Mascot';
import { AddPhotoButton, Timeline } from '../components/Photos';
import { Card, H2, Muted, ProgressBar, Screen } from '../components/ui';
import { personalize } from '../content';
import { getPhotos, type Photo } from '../lib/db';
import { useDog } from '../lib/dog-context';
import { LEVELS, nextLevel, SOCIAL_GOAL } from '../lib/levels';
import { colors, radius, space } from '../lib/theme';
import { usePlan } from '../lib/use-plan';

export default function Progreso() {
  const { dog } = useDog();
  const db = useSQLiteContext();
  const { state, reload } = usePlan(dog);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const loadPhotos = useCallback(async () => {
    if (dog) setPhotos(await getPhotos(db, dog.id));
  }, [db, dog]);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos]),
  );

  if (!dog || !state) return <Screen underHeader>{null}</Screen>;

  const input = { achieved: state.progress.achieved, socialCovered: state.socialCovered.size };
  const next = nextLevel(input);
  const currentIndex = state.level ? LEVELS.indexOf(state.level) : -1;

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: '' }} />
      <LevelUp
        dog={dog}
        plan={state}
        onDone={() => {
          reload();
          loadPhotos();
        }}
      />

      <Card style={styles.hero}>
        <Spots />
        <Mascot size={140} />
        <Text style={styles.levelName}>{state.level ? `${state.level.emoji} ${state.level.name}` : 'Recién empezando'}</Text>
        <Muted>{state.level ? state.level.summary : personalize('Lográ la primera lección para que {nombre} sea Semilla 🌱.', dog)}</Muted>
        <View style={styles.streak}>
          <Text style={styles.streakValue}>🔥 {state.streak}</Text>
          <Muted>{state.streak === 1 ? 'día seguido practicando' : 'días seguidos practicando'}</Muted>
        </View>
      </Card>

      {next ? (
        <Card>
          <H2>
            Para llegar a {next.level.emoji} {next.level.name}
          </H2>
          <ProgressBar value={next.done} max={next.level.requirements.length} color={colors.accent} />
          {next.level.requirements.map((r) => {
            const done = !next.pending.includes(r.label);
            return (
              <Text key={r.label} style={[styles.req, done && styles.reqDone]}>
                {done ? '✅' : '⬜'} {r.label}
              </Text>
            );
          })}
          {next.level.id === 'explorador' ? (
            <Muted>
              Socialización: {state.socialCovered.size} de {SOCIAL_GOAL}.
            </Muted>
          ) : null}
        </Card>
      ) : (
        <Card>
          <H2>🎓 ¡Todos los niveles logrados!</H2>
          <Muted>Seguí repasando con distracciones para que lo aprendido dure toda la vida.</Muted>
        </Card>
      )}

      <Card>
        <H2>📸 Línea de tiempo</H2>
        <AddPhotoButton dog={dog} onAdded={loadPhotos} />
        <Timeline dog={dog} photos={photos} onChange={loadPhotos} />
      </Card>

      <Card>
        <H2>Niveles</H2>
        {LEVELS.map((l, i) => (
          <View key={l.id} style={[styles.levelRow, i === currentIndex && styles.levelRowCurrent]}>
            <Text style={[styles.levelEmoji, i > currentIndex && styles.locked]}>{l.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelRowName}>{l.name}</Text>
              <Muted>{l.summary}</Muted>
            </View>
            <Text style={styles.levelState}>{i <= currentIndex ? '✓' : ''}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', overflow: 'hidden', backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  levelName: { fontSize: 28, fontWeight: '800', color: colors.text },
  streak: { alignItems: 'center', marginTop: space.sm },
  streakValue: { fontSize: 30, fontWeight: '800', color: colors.accent },
  req: { fontSize: 16, color: colors.text, lineHeight: 26 },
  reqDone: { color: colors.textMuted },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.sm },
  levelRowCurrent: { backgroundColor: colors.accentSoft },
  levelEmoji: { fontSize: 28 },
  locked: { opacity: 0.35 },
  levelRowName: { fontSize: 17, fontWeight: '700', color: colors.text },
  levelState: { fontSize: 18, fontWeight: '800', color: colors.success },
});
