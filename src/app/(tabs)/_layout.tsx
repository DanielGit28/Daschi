import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { useDog } from '../../lib/dog-context';
import { colors } from '../../lib/theme';

// Íconos con emoji por ahora; el viernes se reemplazan por los del diseño.
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { dog, loading } = useDog();
  if (loading) return null;
  if (!dog) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.caramel,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="hoy" options={{ title: 'Hoy', tabBarIcon: ({ focused }) => <TabIcon emoji="☀️" focused={focused} /> }} />
      <Tabs.Screen name="aprender" options={{ title: 'Aprender', tabBarIcon: ({ focused }) => <TabIcon emoji="🎓" focused={focused} /> }} />
      <Tabs.Screen name="registro" options={{ title: 'Registro', tabBarIcon: ({ focused }) => <TabIcon emoji="📝" focused={focused} /> }} />
      <Tabs.Screen name="recordatorios" options={{ title: 'Avisos', tabBarIcon: ({ focused }) => <TabIcon emoji="🔔" focused={focused} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon emoji="🐾" focused={focused} /> }} />
    </Tabs>
  );
}
