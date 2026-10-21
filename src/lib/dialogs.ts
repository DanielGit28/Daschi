// Diálogos que funcionan igual en el teléfono (Alert) y en la web (en react-native-web, Alert.alert no hace nada).
import { Alert, Platform } from 'react-native';

const web = Platform.OS === 'web';

/** Pide confirmación; en `onConfirm` va la acción (ej. borrar). */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void, destructive = true) {
  if (web) {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** Mensaje simple con botón OK. */
export function notify(title: string, message?: string) {
  if (web) window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
