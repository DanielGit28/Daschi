import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Share, StyleSheet, Text } from 'react-native';
import { DogForm } from '../../components/DogForm';
import { Button, Card, H2, Muted, Screen } from '../../components/ui';
import { exportAll, updateDog } from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { syncReminders } from '../../lib/notifications';
import { colors } from '../../lib/theme';

export default function Perfil() {
  const db = useSQLiteContext();
  const { dog, reload } = useDog();
  const [editing, setEditing] = useState(false);

  if (!dog) return null;

  async function handleExport() {
    const data = await exportAll(db);
    await Share.share({ title: 'Respaldo de Dachsi', message: JSON.stringify(data) });
  }

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
          <Muted>Nació el {dog.birth_date.split('-').reverse().join('/')}</Muted>
          {dog.weight_kg ? <Muted>Peso: {dog.weight_kg} kg</Muted> : null}
          <Button label="Editar" variant="secondary" onPress={() => setEditing(true)} />
        </Card>
      )}

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
});
