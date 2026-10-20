import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, H2, Muted, Screen } from '../../components/ui';
import {
  addFixedReminder,
  deleteReminder,
  getReminders,
  updateReminder,
  type Reminder,
  type ReminderKind,
  type ReminderPatch,
} from '../../lib/db';
import { useDog } from '../../lib/dog-context';
import { ensureNotificationPermission, hasNotificationPermission, syncReminders } from '../../lib/notifications';
import { formatTime, parseTime } from '../../lib/schedule';
import { colors, radius, space } from '../../lib/theme';

const INTERVALS = [30, 45, 60, 90, 120];
const QUIET_STARTS = ['21:00', '22:00', '23:00'];
const QUIET_ENDS = ['05:00', '06:00', '07:00'];

const KINDS: Array<{ kind: ReminderKind; label: string; emoji: string }> = [
  { kind: 'comida', label: 'Comida', emoji: '🍽️' },
  { kind: 'siesta', label: 'Siesta', emoji: '😴' },
  { kind: 'sesion', label: 'Sesión', emoji: '🎓' },
  { kind: 'bano', label: 'Baño', emoji: '🐾' },
];

const emojiFor = (kind: ReminderKind) => KINDS.find((k) => k.kind === kind)?.emoji ?? '⏰';

type Draft = { id: string | 'new'; kind: ReminderKind; label: string; time: string };

export default function Recordatorios() {
  const db = useSQLiteContext();
  const { dog } = useDog();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [permission, setPermission] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!dog) return;
    setReminders(await getReminders(db, dog.id));
    setPermission(await hasNotificationPermission());
  }, [db, dog]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!dog) return null;

  const potty = reminders.find((r) => r.interval_min != null);
  const fixed = reminders.filter((r) => r.interval_min == null);

  async function save(id: string, patch: ReminderPatch) {
    if (patch.enabled) {
      const ok = await ensureNotificationPermission();
      setPermission(ok);
      if (!ok) {
        Alert.alert(
          'Notificaciones apagadas',
          'Para recibir recordatorios, activá las notificaciones de Expo Go en Ajustes.',
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
          ],
        );
      }
    }
    await updateReminder(db, id, patch);
    await load();
    await syncReminders(db);
  }

  async function saveDraft() {
    if (!draft || !dog) return;
    const minutes = parseTime(draft.time);
    if (!draft.label.trim()) return setError('Ponele un nombre, por ejemplo "Salida de madrugada".');
    if (minutes == null) return setError('La hora va como HH:MM en formato 24 h, por ejemplo 02:30 o 17:30.');
    const time = formatTime(minutes);
    setError(null);
    if (draft.id === 'new') {
      await ensureNotificationPermission().then(setPermission);
      await addFixedReminder(db, dog.id, draft.kind, draft.label.trim(), time);
    } else {
      await updateReminder(db, draft.id, { kind: draft.kind, label: draft.label.trim(), time_of_day: time });
    }
    setDraft(null);
    await load();
    await syncReminders(db);
  }

  function confirmDelete(r: Reminder) {
    Alert.alert('Borrar recordatorio', `¿Borrar "${r.label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteReminder(db, r.id);
          setDraft(null);
          await load();
          await syncReminders(db);
        },
      },
    ]);
  }

  return (
    <Screen title="Recordatorios">
      {!permission && reminders.some((r) => r.enabled) ? (
        <Card style={styles.warning}>
          <Muted>Las notificaciones están apagadas. Sin permiso, Dachsi no puede avisarte.</Muted>
          <Button label="Abrir Ajustes" variant="secondary" onPress={() => Linking.openSettings()} />
        </Card>
      ) : null}

      {potty ? (
        <Card>
          <View style={styles.header}>
            <H2>🐾 {potty.label}</H2>
            <Switch value={!!potty.enabled} onValueChange={(v) => save(potty.id, { enabled: v ? 1 : 0 })} trackColor={{ true: colors.success }} />
          </View>
          <Muted>Cuenta desde el último registro de baño. Después de comer, dormir o jugar, sacala igual.</Muted>

          <Text style={styles.label}>Cada</Text>
          <View style={styles.chips}>
            {INTERVALS.map((m) => (
              <Chip key={m} label={`${m} min`} selected={potty.interval_min === m} onPress={() => save(potty.id, { interval_min: m })} />
            ))}
          </View>

          <Text style={styles.label}>Silencio de noche desde</Text>
          <View style={styles.chips}>
            {QUIET_STARTS.map((t) => (
              <Chip key={t} label={t} selected={potty.quiet_start === t} onPress={() => save(potty.id, { quiet_start: t })} />
            ))}
          </View>
          <Text style={styles.label}>hasta</Text>
          <View style={styles.chips}>
            {QUIET_ENDS.map((t) => (
              <Chip key={t} label={t} selected={potty.quiet_end === t} onPress={() => save(potty.id, { quiet_end: t })} />
            ))}
          </View>
          <Muted>De noche no hay avisos cada hora: al terminar el silencio llega uno de buenos días. Para salidas de madrugada, agregá un recordatorio de baño a hora fija.</Muted>
        </Card>
      ) : null}

      <Card>
        <H2>A hora fija</H2>
        <Muted>Suenan todos los días. Tocá uno para editarlo.</Muted>
        {fixed.map((r) =>
          draft?.id === r.id ? (
            <DraftEditor key={r.id} draft={draft} error={error} onChange={setDraft} onSave={saveDraft} onCancel={() => setDraft(null)} onDelete={() => confirmDelete(r)} />
          ) : (
            <Pressable
              key={r.id}
              style={styles.row}
              onPress={() => {
                setError(null);
                setDraft({ id: r.id, kind: r.kind, label: r.label, time: r.time_of_day ?? '' });
              }}
            >
              <Text style={styles.rowTime}>{r.time_of_day}</Text>
              <Text style={styles.rowLabel}>
                {emojiFor(r.kind)} {r.label}
              </Text>
              <Switch value={!!r.enabled} onValueChange={(v) => save(r.id, { enabled: v ? 1 : 0 })} trackColor={{ true: colors.success }} />
            </Pressable>
          ),
        )}
        {draft?.id === 'new' ? (
          <DraftEditor draft={draft} error={error} onChange={setDraft} onSave={saveDraft} onCancel={() => setDraft(null)} />
        ) : (
          <Button
            label="+ Agregar recordatorio"
            variant="secondary"
            onPress={() => {
              setError(null);
              setDraft({ id: 'new', kind: 'siesta', label: '', time: '' });
            }}
          />
        )}
      </Card>
    </Screen>
  );
}

type EditorProps = {
  draft: Draft;
  error: string | null;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
};

function DraftEditor({ draft, error, onChange, onSave, onCancel, onDelete }: EditorProps) {
  return (
    <View style={styles.editor}>
      <View style={styles.chips}>
        {KINDS.map((k) => (
          <Chip key={k.kind} label={`${k.emoji} ${k.label}`} selected={draft.kind === k.kind} onPress={() => onChange({ ...draft, kind: k.kind })} />
        ))}
      </View>
      <TextInput placeholderTextColor={colors.textMuted} keyboardAppearance="dark"
        style={styles.input}
        value={draft.label}
        onChangeText={(label) => onChange({ ...draft, label })}
        placeholder="Nombre, ej. Salida de madrugada"
      />
      <TextInput placeholderTextColor={colors.textMuted} keyboardAppearance="dark"
        style={styles.input}
        value={draft.time}
        onChangeText={(time) => onChange({ ...draft, time })}
        placeholder="Hora, ej. 02:30"
        keyboardType="numbers-and-punctuation"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.buttons}>
        <View style={{ flex: 1 }}>
          <Button label="Cancelar" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Guardar" onPress={onSave} />
        </View>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={styles.delete}>Borrar recordatorio</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  warning: { backgroundColor: colors.accentSoft },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginTop: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowTime: { width: 56, fontSize: 16, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  rowLabel: { flex: 1, fontSize: 16, color: colors.text },
  editor: { gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 15 },
  buttons: { flexDirection: 'row', gap: space.sm },
  delete: { color: colors.danger, fontSize: 15, textAlign: 'center', paddingVertical: space.xs },
});
