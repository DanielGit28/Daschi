import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ageInDays, formatHumanDate, parseHumanDate } from '../lib/age';
import type { Dog, DogInput, Sex } from '../lib/db';
import { colors, radius, space } from '../lib/theme';
import { Button, Chip } from './ui';

type Props = {
  initial?: Dog | null;
  submitLabel: string;
  onSubmit: (input: DogInput) => Promise<void>;
};

export function DogForm({ initial, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [breed, setBreed] = useState(initial?.breed ?? 'Dachshund (salchicha)');
  const [birth, setBirth] = useState(initial ? formatHumanDate(initial.birth_date) : '');
  const [weight, setWeight] = useState(initial?.weight_kg != null ? String(initial.weight_kg) : '');
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const birthISO = parseHumanDate(birth);
    if (!name.trim()) return setError('Escribí el nombre del cachorro.');
    if (!birthISO) return setError('La fecha de nacimiento va como DD/MM/AAAA, por ejemplo 24/08/2026.');
    if (ageInDays(birthISO) === 0 && birthISO !== todayISO()) return setError('La fecha de nacimiento no puede ser en el futuro.');
    const weightNum = weight.trim() ? Number(weight.replace(',', '.')) : null;
    if (weightNum !== null && (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 40)) {
      return setError('El peso va en kilos, por ejemplo 1.8.');
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        breed: breed.trim() || 'Dachshund (salchicha)',
        birth_date: birthISO,
        weight_kg: weightNum,
        sex,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field label="Nombre">
        <TextInput placeholderTextColor={colors.textMuted} keyboardAppearance="dark" style={styles.input} value={name} onChangeText={setName} placeholder="Ej. Canela" autoCapitalize="words" returnKeyType="next" />
      </Field>
      <Field label="¿Macho o hembra?">
        <View style={styles.chips}>
          <Chip label="♀ Hembra" selected={sex === 'hembra'} onPress={() => setSex('hembra')} />
          <Chip label="♂ Macho" selected={sex === 'macho'} onPress={() => setSex('macho')} />
        </View>
      </Field>
      <Field label="Raza">
        <TextInput placeholderTextColor={colors.textMuted} keyboardAppearance="dark" style={styles.input} value={breed} onChangeText={setBreed} />
      </Field>
      <Field label="Fecha de nacimiento (DD/MM/AAAA)">
        <TextInput placeholderTextColor={colors.textMuted} keyboardAppearance="dark"
          style={styles.input}
          value={birth}
          onChangeText={setBirth}
          placeholder="24/08/2026"
          keyboardType="numbers-and-punctuation"
        />
      </Field>
      <Field label="Peso en kg (opcional)">
        <TextInput placeholderTextColor={colors.textMuted} keyboardAppearance="dark" style={styles.input} value={weight} onChangeText={setWeight} placeholder="1.8" keyboardType="decimal-pad" />
      </Field>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={saving ? 'Guardando…' : submitLabel} onPress={handleSubmit} disabled={saving} big />
    </View>
  );
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  chips: { flexDirection: 'row', gap: space.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 15 },
});
