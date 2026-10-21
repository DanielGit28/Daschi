import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActivityKind, ActivityLog, PottyLog } from '../lib/db';
import { confirmAction } from '../lib/dialogs';
import { colors, space } from '../lib/theme';

/** 'pipí afuera', 'popó adentro', ... */
export function pottyText(l: Pick<PottyLog, 'kind' | 'place'>) {
  return `${l.kind === 'pipi' ? 'pipí' : 'popó'} ${l.place === 'fuera' ? 'afuera' : 'adentro'}`;
}

export function pottyLabel(l: Pick<PottyLog, 'kind' | 'place'>) {
  const text = pottyText(l);
  return `${l.kind === 'pipi' ? '💧' : '💩'} ${text[0].toUpperCase()}${text.slice(1)}`;
}

const ACTIVITY: Record<ActivityKind, { emoji: string; text: string }> = {
  comida: { emoji: '🍽️', text: 'Comió' },
  dormir: { emoji: '😴', text: 'Se durmió' },
  despertar: { emoji: '☀️', text: 'Despertó' },
};

export const activityLabel = (kind: ActivityKind) => `${ACTIVITY[kind].emoji} ${ACTIVITY[kind].text}`;

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });
}

/** Registro del día: baño o rutina (comida, siesta), con su color y cómo borrarlo. */
export type DayEntry = { id: string; type: 'potty' | 'activity'; label: string; at: string; color: string };

export function toEntries(potty: PottyLog[], activities: ActivityLog[]): DayEntry[] {
  return [
    ...potty.map((l) => ({
      id: l.id,
      type: 'potty' as const,
      label: pottyLabel(l),
      at: l.logged_at,
      color: l.place === 'fuera' ? colors.success : colors.accent,
    })),
    ...activities.map((a) => ({ id: a.id, type: 'activity' as const, label: activityLabel(a.kind), at: a.logged_at, color: colors.spotGrey })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

/** Fila de un registro con botón visible para borrarlo (pide confirmación). */
export function LogRow({ entry, onDelete }: { entry: DayEntry; onDelete: (entry: DayEntry) => void }) {
  function confirm() {
    confirmAction('Borrar registro', `¿Borrar "${entry.label.slice(entry.label.indexOf(' ') + 1)}" de las ${timeLabel(entry.at)}?`, 'Borrar', () =>
      onDelete(entry),
    );
  }

  return (
    <Pressable onLongPress={confirm} style={styles.item}>
      <View style={[styles.dot, { backgroundColor: entry.color }]} />
      <Text style={styles.time}>{timeLabel(entry.at)}</Text>
      <Text style={styles.what}>{entry.label}</Text>
      <Pressable onPress={confirm} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar registro" style={styles.delete}>
        <Text style={styles.deleteText}>🗑</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  time: { width: 72, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  what: { flex: 1, fontSize: 16, color: colors.text },
  delete: { paddingHorizontal: space.sm, paddingVertical: 4 },
  deleteText: { fontSize: 18 },
});
