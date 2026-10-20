import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Share, StyleSheet, Text } from 'react-native';
import { DogForm } from '../../components/DogForm';
import { Button, Card, H2, Muted, Screen } from '../../components/ui';
import { CONTENT } from '../../content';
import { formatHumanDate } from '../../lib/age';
import { exportAll, updateDog } from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { syncReminders } from '../../lib/notifications';
import { activeGoals } from '../../lib/plan';
import { colors } from '../../lib/theme';
import { usePlan } from '../../lib/use-plan';

const SPOT_LABEL = { patio: 'patio o jardín', calle: 'calle, con correa', empapador: 'empapador o terraza' };
const HOUSEHOLD_LABEL = { solo: 'Solo yo', familia: 'Pareja o familia', ninos: 'Familia con niños' };

export default function Perfil() {
  const db = useSQLiteContext();
  const { dog, reload } = useDog();
  const { state } = usePlan(dog);
  const [editing, setEditing] = useState(false);

  if (!dog) return null;

  async function handleExport() {
    const data = await exportAll(db);
    await Share.share({ title: 'Respaldo de Dachsi', message: JSON.stringify(data) });
  }

  const goals = state ? activeGoals(state.profile, CONTENT.goals) : [];

  return (
    <Screen title="Perfil">
      {editing ? (
        <DogForm
          initial={dog}
          submitLabel="Guardar cambios"
          onSubmit={async (input) => {
            await updateDog(db, dog.id, input);
            await reload();
            await syncReminders(db); // los avisos llevan el nombre del cachorro
            setEditing(false);
          }}
        />
      ) : (
        <Card>
          <Text style={styles.name}>{dog.name}</Text>
          <Muted>{dog.breed}</Muted>
          <Muted>Nació el {formatHumanDate(dog.birth_date)}</Muted>
          {dog.arrival_date ? (
            <Muted>
              {state?.profile.preArrival ? 'Llega' : 'En casa desde'} el {formatHumanDate(dog.arrival_date)}
            </Muted>
          ) : null}
          {dog.weight_kg ? <Muted>Peso: {dog.weight_kg} kg</Muted> : null}
          <Button label="Editar" variant="secondary" onPress={() => setEditing(true)} />
        </Card>
      )}

      <Card>
        <H2>Mis enfoques</H2>
        <Text style={styles.goals}>{goals.map((a) => `${a.goal.emoji} ${a.goal.name}`).join('   ')}</Text>
        {dog.daily_minutes ? <Muted>{dog.daily_minutes} minutos de entrenamiento al día</Muted> : null}
        {dog.potty_spot ? <Muted>Baño en {SPOT_LABEL[dog.potty_spot]}</Muted> : null}
        {dog.household ? <Muted>Entrenan: {HOUSEHOLD_LABEL[dog.household]}</Muted> : null}
        <Button label="Cambiar respuestas" variant="secondary" onPress={() => router.push('/enfoques?editar=1')} />
      </Card>

      <Card>
        <H2>Respaldo</H2>
        <Muted>
          Guarda todos los datos como texto JSON (por ejemplo en Notas o enviándotelo por correo). Sirve para no perder el historial
          cuando Dachsi pase de Expo Go a app propia.
        </Muted>
        <Button
          label="Exportar respaldo"
          variant="secondary"
          onPress={() => handleExport().catch((e) => Alert.alert('No se pudo exportar', String(e)))}
        />
      </Card>

      <Muted>Dachsi no reemplaza al veterinario. Ante cualquier duda de salud, consultá con tu veterinario.</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  goals: { fontSize: 16, color: colors.text, lineHeight: 24 },
});
