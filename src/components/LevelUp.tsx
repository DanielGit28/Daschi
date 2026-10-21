import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { personalize } from '../content';
import { setItemDone, type Dog } from '../lib/db';
import { LEVELS, levelItemId } from '../lib/levels';
import { colors, radius, space } from '../lib/theme';
import type { PlanState } from '../lib/use-plan';
import { Mascot, Spots } from './Mascot';
import { AddPhotoButton } from './Photos';
import { Button, Muted } from './ui';

const CONFETTI = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * Math.PI * 2,
  distance: 110 + (i % 3) * 30,
  color: [colors.accent, colors.spotLight, colors.spotGrey, colors.success][i % 4],
  size: 8 + (i % 3) * 4,
}));

/**
 * Si la mascota alcanzó un nivel que todavía no se celebró en ningún dispositivo, muestra la
 * celebración con Churro animado. Al cerrarla, marca el nivel (y los anteriores) como celebrados.
 */
export function LevelUp({ dog, plan, onDone }: { dog: Dog; plan: PlanState; onDone: () => void }) {
  const db = useSQLiteContext();
  const level = plan.level && !plan.done.has(levelItemId(plan.level.id)) ? plan.level : null;

  async function close() {
    if (!level) return;
    for (const l of LEVELS.slice(0, LEVELS.indexOf(level) + 1)) {
      if (!plan.done.has(levelItemId(l.id))) await setItemDone(db, dog.id, levelItemId(l.id), true);
    }
    onDone();
  }

  return (
    <Modal visible={!!level} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        {level ? <Celebration dog={dog} levelId={level.id} emoji={level.emoji} name={level.name} summary={level.summary} onClose={close} /> : null}
      </View>
    </Modal>
  );
}

type CelebrationProps = { dog: Dog; levelId: string; emoji: string; name: string; summary: string; onClose: () => void };

function Celebration({ dog, levelId, emoji, name, summary, onClose }: CelebrationProps) {
  const pop = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 70, useNativeDriver: native }),
      Animated.timing(burst, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 350, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(wiggle, { toValue: -1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(wiggle, { toValue: 0, duration: 350, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pop, wiggle, burst, native]);

  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });
  const hop = wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, -8, 0] });

  return (
    <View style={styles.card}>
      <Spots />
      <View style={styles.stage}>
        {CONFETTI.map((c, i) => (
          <Animated.View
            key={i}
            style={[
              styles.confetti,
              {
                width: c.size,
                height: c.size * 0.7,
                backgroundColor: c.color,
                opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(c.angle) * c.distance] }) },
                  { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(c.angle) * c.distance] }) },
                ],
              },
            ]}
          />
        ))}
        <Animated.View style={{ transform: [{ scale: pop }, { translateY: hop }, { rotate }] }}>
          <Mascot size={190} />
        </Animated.View>
      </View>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{personalize(`¡{nombre} subió a ${name}!`, dog)}</Text>
      <Muted>{summary}</Muted>
      <Muted>Sacale una foto para recordar este momento.</Muted>
      <View style={styles.actions}>
        <AddPhotoButton dog={dog} levelId={levelId} label="📷 Foto del momento" onAdded={onClose} />
        <Button label="¡Bien!" onPress={onClose} big />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: space.md },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'center',
    overflow: 'hidden',
  },
  stage: { height: 150, alignItems: 'center', justifyContent: 'center' },
  confetti: { position: 'absolute', borderRadius: 6 },
  emoji: { fontSize: 44 },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
});
