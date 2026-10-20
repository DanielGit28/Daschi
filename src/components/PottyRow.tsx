import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PottyLog } from '../lib/db';
import { colors, space } from '../lib/theme';

/** 'pipí afuera', 'popó adentro', ... */
export function pottyText(l: Pick<PottyLog, 'kind' | 'place'>) {
  return `${l.kind === 'pipi' ? 'pipí' : 'popó'} ${l.place === 'fuera' ? 'afuera' : 'adentro'}`;
}

export function pottyLabel(l: Pick<PottyLog, 'kind' | 'place'>) {
  const text = pottyText(l);
  return `${l.kind === 'pipi' ? '💧' : '💩'} ${text[0].toUpperCase()}${text.slice(1)}`;
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });
}

/** Fila de un registro de baño con botón visible para borrarlo (pide confirmación). */
export function PottyRow({ log, onDelete }: { log: PottyLog; onDelete: (log: PottyLog) => void }) {
  function confirm() {
    Alert.alert('Borrar registro', `¿Borrar ${pottyText(log)} de las ${timeLabel(log.logged_at)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => onDelete(log) },
    ]);
  }

  return (
    <Pressable onLongPress={confirm} style={styles.item}>
      <View style={[styles.dot, { backgroundColor: log.place === 'fuera' ? colors.success : colors.accent }]} />
      <Text style={styles.time}>{timeLabel(log.logged_at)}</Text>
      <Text style={styles.what}>{pottyLabel(log)}</Text>
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
