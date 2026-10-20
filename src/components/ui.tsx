import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, space } from '../lib/theme';

/** `underHeader`: la pantalla tiene encabezado de navegación, que ya respeta el área segura de arriba. */
export function Screen({ children, title, underHeader }: { children: ReactNode; title?: string; underHeader?: boolean }) {
  return (
    <SafeAreaView style={styles.safe} edges={underHeader ? [] : ['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'green';
  disabled?: boolean;
  big?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, big }: ButtonProps) {
  const bg = variant === 'primary' ? colors.accent : variant === 'green' ? colors.success : colors.surfaceRaised;
  const fg = variant === 'primary' ? colors.onAccent : variant === 'green' ? colors.onSuccess : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        big && styles.buttonBig,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, big && styles.buttonTextBig, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Opción de un toque (por ejemplo "60 min"); `selected` la resalta. */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, max, color = colors.success }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Fila con casilla para marcar, toda la fila es tocable. */
export function CheckRow({ checked, label, detail, onPress }: { checked: boolean; label: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.checkRow}>
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>{checked ? <Text style={styles.checkMark}>✓</Text> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.checkLabel, checked && styles.checkLabelOn]}>{label}</Text>
        {detail ? <Text style={styles.muted}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: space.md, paddingBottom: space.xl * 2, gap: space.md },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, marginTop: space.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBig: { paddingVertical: 18, borderRadius: radius.md },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextBig: { fontSize: 18 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkBoxOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: colors.onSuccess, fontWeight: '800', fontSize: 15 },
  checkLabel: { fontSize: 16, color: colors.text },
  checkLabelOn: { color: colors.textMuted, textDecorationLine: 'line-through' },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text },
  chipTextSelected: { color: colors.onAccent },
  muted: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  h2: { fontSize: 19, fontWeight: '700', color: colors.text },
});
