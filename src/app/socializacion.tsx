import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { timeLabel } from '../components/PottyRow';
import { Button, Card, Muted, ProgressBar, Screen } from '../components/ui';
import { CONTENT } from '../content';
import { addSocializationLog, deleteSocializationLog, type Reaction } from '../lib/db';
import { useDog } from '../lib/dog-context';
import { colors, radius, space } from '../lib/theme';
import { usePlan } from '../lib/use-plan';

const REACTIONS: Array<{ value: Reaction; emoji: string; label: string }> = [
  { value: 'bien', emoji: '😀', label: 'Bien' },
  { value: 'dudosa', emoji: '😐', label: 'Dudó' },
  { value: 'miedo', emoji: '😟', label: 'Miedo' },
];
const emojiFor = (r: Reaction) => REACTIONS.find((x) => x.value === r)!.emoji;

function shortDate(iso: string) {
  return `${new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })} ${timeLabel(iso)}`;
}

export default function Socializacion() {
  const db = useSQLiteContext();
  const { dog } = useDog();
  const { state, reload } = usePlan(dog);
  const [open, setOpen] = useState<string | null>(null);

  if (!dog || !state) return <Screen underHeader>{null}</Screen>;

  const groups = new Map<string, typeof CONTENT.socialization>();
  for (const item of CONTENT.socialization) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);

  async function log(itemId: string, reaction: Reaction) {
    await addSocializationLog(db, dog!.id, itemId, reaction);
    await reload();
  }

  async function remove(id: number) {
    await deleteSocializationLog(db, id);
    await reload();
  }

  const covered = state.socialCovered.size;
  const total = CONTENT.socialization.length;

  return (
    <Screen underHeader>
      <Text style={styles.title}>🌎 Socialización</Text>
      <Muted>
        Cada cosa nueva, con calma y premios. Marcá cómo reaccionó {dog.name}: lo que da miedo se repite otro día, más suave y desde más lejos.
      </Muted>
      <Card>
        <Text style={styles.count}>
          {covered} de {total} con una experiencia buena
        </Text>
        <ProgressBar value={covered} max={total} />
        {state.profile.weeks < 16 ? (
          <Muted>Quedan {16 - state.profile.weeks} semanas de la ventana más importante. Meta: 2 o 3 cosas nuevas por día.</Muted>
        ) : null}
      </Card>

      {[...groups.entries()].map(([group, items]) => (
        <Card key={group}>
          <Text style={styles.group}>{group}</Text>
          {items.map((item) => {
            const logs = state.socialLogs.filter((l) => l.item_id === item.id);
            const isOpen = open === item.id;
            return (
              <View key={item.id}>
                <Pressable onPress={() => setOpen(isOpen ? null : item.id)} style={styles.row}>
                  <Text style={styles.mark}>{state.socialCovered.has(item.id) ? '✅' : logs[0] ? emojiFor(logs[0].reaction) : '⬜'}</Text>
                  <Text style={styles.itemText}>{item.text}</Text>
                  {logs.length > 0 ? <Text style={styles.times}>×{logs.length}</Text> : null}
                </Pressable>
                {isOpen ? (
                  <View style={styles.panel}>
                    <Text style={styles.ask}>¿Cómo reaccionó?</Text>
                    <View style={styles.reactions}>
                      {REACTIONS.map((r) => (
                        <View key={r.value} style={{ flex: 1 }}>
                          <Button label={`${r.emoji} ${r.label}`} variant={r.value === 'bien' ? 'green' : 'secondary'} onPress={() => log(item.id, r.value)} />
                        </View>
                      ))}
                    </View>
                    {logs[0]?.reaction === 'miedo' ? (
                      <Muted>Es normal. Próxima vez: más lejos, más corto y con premios de alto valor. Sin forzar.</Muted>
                    ) : null}
                    {logs.map((l) => (
                      <View key={l.id} style={styles.logRow}>
                        <Text style={styles.logText}>
                          {emojiFor(l.reaction)} {shortDate(l.logged_at)}
                        </Text>
                        <Pressable onPress={() => remove(l.id)} hitSlop={10} accessibilityLabel="Borrar">
                          <Text>🗑</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  count: { fontSize: 16, fontWeight: '700', color: colors.text },
  group: { fontSize: 18, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  mark: { fontSize: 18, width: 26, textAlign: 'center' },
  itemText: { flex: 1, fontSize: 16, color: colors.text },
  times: { fontSize: 14, color: colors.textMuted },
  panel: { gap: space.sm, padding: space.sm, backgroundColor: colors.background, borderRadius: radius.sm, marginBottom: space.sm },
  ask: { fontSize: 15, fontWeight: '700', color: colors.text },
  reactions: { flexDirection: 'row', gap: space.xs },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logText: { fontSize: 14, color: colors.textMuted },
});
