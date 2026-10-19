import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, Text, View } from 'react-native';
import { DogForm } from '../components/DogForm';
import { Muted, Screen } from '../components/ui';
import { createDog } from '../lib/db';
import { useDog } from '../lib/dog-context';
import { colors, space } from '../lib/theme';

export default function Onboarding() {
  const db = useSQLiteContext();
  const { reload } = useDog();

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.churro}>🌭</Text>
        <Text style={styles.title}>¡Hola! Soy Churro.</Text>
        <Muted>Contame de tu cachorro y te armo el plan de cada día según su edad.</Muted>
      </View>
      <DogForm
        submitLabel="Empezar"
        onSubmit={async (input) => {
          await createDog(db, input);
          await reload();
          router.replace('/hoy');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, marginVertical: space.lg },
  churro: { fontSize: 64 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
});
