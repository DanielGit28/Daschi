import { Redirect } from 'expo-router';
import { useDog } from '../lib/dog-context';

// Punto de entrada: sin perfil va al onboarding; sin enfoques, a las preguntas; si no, directo a "Hoy".
export default function Index() {
  const { dog, loading } = useDog();
  if (loading) return null;
  if (!dog) return <Redirect href="/onboarding" />;
  return <Redirect href={dog.setup_done ? '/hoy' : '/enfoques'} />;
}
