import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useDog } from '../../lib/dog-context';
import { colors } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(outline: IconName, filled: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? filled : outline} color={color} size={size} />
  );
}

export default function TabsLayout() {
  const { dog, loading } = useDog();
  if (loading) return null;
  if (!dog) return <Redirect href="/mascotas" />;
  if (!dog.setup_done) return <Redirect href="/enfoques" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="hoy" options={{ title: 'Hoy', tabBarIcon: icon('sunny-outline', 'sunny') }} />
      <Tabs.Screen name="aprender" options={{ title: 'Aprender', tabBarIcon: icon('school-outline', 'school') }} />
      <Tabs.Screen name="registro" options={{ title: 'Registro', tabBarIcon: icon('list-outline', 'list') }} />
      <Tabs.Screen name="recordatorios" options={{ title: 'Avisos', tabBarIcon: icon('notifications-outline', 'notifications') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('paw-outline', 'paw') }} />
    </Tabs>
  );
}
