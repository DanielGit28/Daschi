import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { DogForm } from '../../components/DogForm';
import { Button, Card, H2, Muted, Screen } from '../../components/ui';
import { exportAll, getReminders, updateDog, type Reminder } from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { colors, space } from '../../lib/theme';

function reminderWhen(r: Reminder) {
  if (r.interval_min) return `cada ${r.interval_min} min`;
  return r.time_of_day ?? '';
}

export default function Perfil() {
  const db = useSQLiteContext();
  const { dog, reload } = useDog();
  const [editing, setEditing] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (dog) getReminders(db, dog.id).then(setReminders);
    }, [db, dog]),
  );

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
        <H2>Recordatorios</H2>
        <Muted>Ya están creados con horarios típicos para 8 semanas. Se activan y editan el miércoles.</Muted>
        {reminders.map((r) => (
          <View key={r.id} style={styles.reminder}>
            <Text style={styles.reminderLabel}>{r.label}</Text>
            <Text style={styles.reminderWhen}>{reminderWhen(r)}</Text>
          </View>
        ))}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  reminder: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  reminderLabel: { fontSize: 15, color: colors.text, flex: 1 },
  reminderWhen: { fontSize: 15, color: colors.textMuted },
});
