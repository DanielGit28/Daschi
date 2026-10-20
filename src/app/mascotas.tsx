import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mascot, Spots } from '../components/Mascot';
import { Button, Card, Muted, Screen } from '../components/ui';
import { ageLabel } from '../lib/age';
import { useDog } from '../lib/dog-context';
import { syncReminders } from '../lib/notifications';
import { adoptDog, fetchPublicDogs } from '../lib/sync';
import type { PublicDog } from '../lib/sync-schema';
import { colors, space } from '../lib/theme';

/** Elegir con qué mascota trabajar en este dispositivo (propias o perfiles públicos del servidor), o registrar una nueva. */
export default function Mascotas() {
  const db = useSQLiteContext();
  const { dog: current, dogs, selectDog, reload } = useDog();
  const [remote, setRemote] = useState<PublicDog[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicDogs()
      .then(setRemote)
      .catch(() => setOffline(true));
  }, []);

  const localIds = new Set(dogs.map((d) => d.id));
  const list: Array<PublicDog & { local: boolean }> = [
    ...dogs.map((d) => ({ ...d, local: true })),
    ...(remote ?? []).filter((d) => !localIds.has(d.id)).map((d) => ({ ...d, local: false })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  async function choose(d: PublicDog & { local: boolean }) {
    if (!d.local) {
      setOpening(d.id);
      try {
        await adoptDog(db, d.id);
        await reload();
        await syncReminders(db);
      } catch {
        setOpening(null);
        setOffline(true);
        return;
      }
    }
    await selectDog(d.id);
    router.replace('/');
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Mascot size={150} />
        <Text style={styles.title}>{list.length ? '¿Con quién entrenamos hoy?' : '¡Bienvenido a Dachsi!'}</Text>
        <Muted>{list.length ? 'Elegí una mascota o registrá una nueva.' : 'Registrá a tu mascota para armar su plan.'}</Muted>
      </View>

      {list.map((d) => (
        <Pressable key={d.id} onPress={() => choose(d)} disabled={opening != null} accessibilityRole="button">
          <Card style={[styles.dog, d.id === current?.id && styles.current]}>
            <Spots />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{d.name}</Text>
              <Muted>
                {d.breed} · {ageLabel(d.birth_date)}
              </Muted>
            </View>
            {opening === d.id ? (
              <ActivityIndicator color={colors.accent} />
            ) : d.id === current?.id ? (
              <Text style={styles.badge}>Elegida</Text>
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Card>
        </Pressable>
      ))}

      {remote == null && !offline ? <ActivityIndicator color={colors.textMuted} /> : null}
      {offline ? <Muted>Sin conexión: solo se muestran las mascotas guardadas en este dispositivo.</Muted> : null}

      <Button label="+ Registrar una mascota" variant={list.length ? 'secondary' : 'primary'} onPress={() => router.push('/onboarding')} big />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, marginVertical: space.lg },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  dog: { flexDirection: 'row', alignItems: 'center', gap: space.md, overflow: 'hidden', paddingVertical: space.lg },
  current: { borderColor: colors.accent, borderWidth: 2 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  badge: { fontSize: 13, fontWeight: '800', color: colors.accent },
  chevron: { fontSize: 28, color: colors.textMuted },
});
