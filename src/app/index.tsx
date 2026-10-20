import { Redirect } from 'expo-router';
import { useDog } from '../lib/dog-context';

// Punto de entrada: sin mascota elegida va a elegir o registrar una; sin enfoques, a las preguntas; si no, a "Hoy".
export default function Index() {
  const { dog, loading } = useDog();
  if (loading) return null;
  if (!dog) return <Redirect href="/mascotas" />;
  return <Redirect href={dog.setup_done ? '/hoy' : '/enfoques'} />;
}
