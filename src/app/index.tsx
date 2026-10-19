import { Redirect } from 'expo-router';
import { useDog } from '../lib/dog-context';

// Punto de entrada: sin perfil va al onboarding; con perfil, directo a "Hoy".
export default function Index() {
  const { dog, loading } = useDog();
  if (loading) return null;
  return <Redirect href={dog ? '/hoy' : '/onboarding'} />;
}
