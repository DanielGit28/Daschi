import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, Text, View } from 'react-native';
import { DogForm } from '../components/DogForm';
import { Mascot } from '../components/Mascot';
import { Button, Muted, Screen } from '../components/ui';
import { createDog } from '../lib/db';
import { useDog } from '../lib/dog-context';
import { colors, space } from '../lib/theme';

export default function Onboarding() {
  const db = useSQLiteContext();
  const { dogs, selectDog } = useDog();

  return (
    <Screen>
      <View style={styles.hero}>
        <Mascot size={180} />
        <Text style={styles.title}>¡Hola! Soy Churro.</Text>
        <Muted>Contame de tu cachorro y te armo el plan de cada día según su edad y lo que quieras trabajar.</Muted>
      </View>
      <DogForm
        submitLabel="Empezar"
        onSubmit={async (input) => {
          const id = await createDog(db, input);
          await selectDog(id);
          router.replace('/enfoques');
        }}
      />
      {dogs.length > 0 ? <Button label="Cancelar" variant="secondary" onPress={() => router.back()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, marginVertical: space.lg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
});
