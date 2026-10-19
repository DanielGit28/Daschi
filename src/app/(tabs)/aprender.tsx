import { StyleSheet, Text, View } from 'react-native';
import { Card, Muted, Screen } from '../../components/ui';
import { ageInWeeks, STAGES, stageForWeeks } from '../../lib/age';
import { useDog } from '../../lib/dog-context';
import { colors, space } from '../../lib/theme';

export default function Aprender() {
  const { dog } = useDog();
  if (!dog) return null;
  const current = stageForWeeks(ageInWeeks(dog.birth_date));

  return (
    <Screen title="Aprender">
      <Muted>El plan avanza por etapas según la edad de {dog.name}. Las lecciones de cada etapa llegan esta semana.</Muted>
      {STAGES.map((s) => {
        const active = s.number === current.number;
        return (
          <Card key={s.number} style={active ? styles.active : undefined}>
            <View style={styles.header}>
              <Text style={styles.name}>
                {s.number}. {s.name}
              </Text>
              {active ? <Text style={styles.badge}>Ahora</Text> : null}
            </View>
            <Muted>{s.range}</Muted>
            <Text style={styles.focus}>{s.focus}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  active: { borderColor: colors.caramel, borderWidth: 2, backgroundColor: colors.caramelSoft },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  badge: {
    backgroundColor: colors.caramel,
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  focus: { fontSize: 15, color: colors.text },
});
