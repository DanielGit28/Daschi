// Recordatorios locales con expo-notifications (funcionan en Expo Go, sin servidor).
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { getDog, getLastPottyLog, getReminders, type Dog, type Reminder } from './db';
import { parseTime, pottySlots, type PottySlot } from './schedule';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

if (supported) {
  // Mostrar el aviso también cuando la app está abierta.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function isGranted(status: Notifications.NotificationPermissionsStatus) {
  if (status.granted) return true;
  const ios = status.ios?.status;
  return ios === Notifications.IosAuthorizationStatus.PROVISIONAL || ios === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

export async function hasNotificationPermission() {
  if (!supported) return false;
  return isGranted(await Notifications.getPermissionsAsync());
}

/** Pide permiso solo si todavía no se decidió. Devuelve si se pueden mostrar avisos. */
export async function ensureNotificationPermission() {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;
  if (!current.canAskAgain) return false;
  return isGranted(await Notifications.requestPermissionsAsync());
}

function durationLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function pottyContent(dog: Dog, reminder: Reminder, slot: PottySlot): Notifications.NotificationContentInput {
  if (slot.kind === 'morning') {
    return { title: '¡Buenos días! ☀️', body: `Primera salida al baño del día con ${dog.name}.` };
  }
  // Si pasó mucho más que el intervalo, probablemente hubo salidas sin registrar: no dar una cifra rara.
  const body =
    slot.sinceMin != null && slot.sinceMin <= (reminder.interval_min ?? 0) * 1.5
      ? `Pasaron ${durationLabel(slot.sinceMin)} desde la última vez. Afuera y premio en el momento.`
      : `Hora de sacar a ${dog.name}. Afuera y premio en el momento.`;
  return { title: '¿Salimos al baño? 🐾', body };
}

function fixedContent(dog: Dog, r: Reminder): Notifications.NotificationContentInput {
  switch (r.kind) {
    case 'comida':
      return { title: `${r.label} 🍽️`, body: `Hora de comer para ${dog.name}. Después de comer, salida al baño.` };
    case 'siesta':
      return { title: `${r.label} 😴`, body: `Llevá a ${dog.name} a su espacio tranquilo para dormir.` };
    case 'sesion':
      return { title: `${r.label} 🎓`, body: `5 minutos con ${dog.name}, premios chiquitos y terminar con un logro.` };
    case 'bano':
      return { title: `${r.label} 🐾`, body: `Salida al baño con ${dog.name}.` };
  }
}

async function scheduleAll(db: SQLiteDatabase) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const dog = await getDog(db);
  if (!dog || !(await hasNotificationPermission())) return;

  const [reminders, last] = await Promise.all([getReminders(db, dog.id), getLastPottyLog(db, dog.id)]);
  const now = new Date();

  for (const r of reminders) {
    if (!r.enabled) continue;
    if (r.interval_min) {
      const slots = pottySlots({
        lastLog: last ? new Date(last.logged_at) : null,
        now,
        intervalMin: r.interval_min,
        quietStart: parseTime(r.quiet_start),
        quietEnd: parseTime(r.quiet_end),
      });
      for (const slot of slots) {
        await Notifications.scheduleNotificationAsync({
          content: pottyContent(dog, r, slot),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.at },
        });
      }
    } else {
      const minutes = parseTime(r.time_of_day);
      if (minutes == null) continue;
      await Notifications.scheduleNotificationAsync({
        content: fixedContent(dog, r),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(minutes / 60), minute: minutes % 60 },
      });
    }
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Vuelve a programar todos los avisos desde la base de datos. Se llama al abrir la app,
 * al registrar o borrar un baño y al editar recordatorios. Las llamadas van en fila para
 * que dos sincronizaciones seguidas no dupliquen avisos.
 */
export function syncReminders(db: SQLiteDatabase): Promise<void> {
  if (!supported) return Promise.resolve();
  queue = queue.then(() => scheduleAll(db)).catch((e) => console.warn('No se pudieron programar los recordatorios', e));
  return queue;
}
