import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Mascot, Spots } from '../components/Mascot';
import { Button, Card, Muted, Screen } from '../components/ui';
import { ageLabel } from '../lib/age';
import { useDog } from '../lib/dog-context';
import { colors, space } from '../lib/theme';

/** Elegir con qué mascota trabajar en este dispositivo, o registrar una nueva. */
export default function Mascotas() {
  const { dog: current, dogs, selectDog } = useDog();

  async function choose(id: string) {
    await selectDog(id);
    router.replace('/');
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Mascot size={150} />
        <Text style={styles.title}>{dogs.length ? '¿Con quién entrenamos hoy?' : '¡Bienvenido a Dachsi!'}</Text>
        <Muted>{dogs.length ? 'Elegí una mascota o registrá una nueva.' : 'Registrá a tu mascota para armar su plan.'}</Muted>
      </View>

      {dogs.map((d) => (
        <Pressable key={d.id} onPress={() => choose(d.id)} accessibilityRole="button">
          <Card style={[styles.dog, d.id === current?.id && styles.current]}>
            <Spots />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{d.name}</Text>
              <Muted>
                {d.breed} · {ageLabel(d.birth_date)}
              </Muted>
            </View>
            {d.id === current?.id ? <Text style={styles.badge}>Elegida</Text> : <Text style={styles.chevron}>›</Text>}
          </Card>
        </Pressable>
      ))}

      <Button label="+ Registrar una mascota" variant={dogs.length ? 'secondary' : 'primary'} onPress={() => router.push('/onboarding')} big />
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
