// Recordatorios: en el teléfono, notificaciones locales (expo-notifications, funcionan en Expo Go);
// en la web, Web Push agendado en el servidor (ver web-push.ts). La lista de avisos es la misma.
import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { getDogs, getLastActivity, getLastPottyLog, getReminders, type Dog, type Reminder } from './db';
import { nextAtTime, parseTime, pottySlots, routineHint, type PottySlot } from './schedule';
import { enableWebPush, scheduleWebPush, webPushStatus, type WebJob } from './web-push';

const native = Platform.OS === 'ios' || Platform.OS === 'android';
const web = Platform.OS === 'web';

if (native) {
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

export async function hasNotificationPermission(db: SQLiteDatabase) {
  if (web) return (await webPushStatus(db)) === 'on';
  if (!native) return false;
  return isGranted(await Notifications.getPermissionsAsync());
}

/** Pide permiso solo si todavía no se decidió. Devuelve si se pueden mostrar avisos. Llamar desde un toque. */
export async function ensureNotificationPermission(db: SQLiteDatabase) {
  if (web) return (await webPushStatus(db)) === 'on' || enableWebPush(db);
  if (!native) return false;
  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;
  if (!current.canAskAgain) return false;
  return isGranted(await Notifications.requestPermissionsAsync());
}

type Content = { title: string; body: string };

function durationLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function pottyContent(dog: Dog, reminder: Reminder, slot: PottySlot): Content {
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

function fixedContent(dog: Dog, r: Reminder): Content {
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

type Jobs = { once: Array<Content & { at: Date }>; daily: Array<Content & { minutes: number }> };

/** Todos los avisos pendientes de todas las mascotas: los de una vez (baño, después de comer) y los diarios. */
async function buildJobs(db: SQLiteDatabase, maxPending: number): Promise<Jobs> {
  const dogs = await getDogs(db);
  const perDog = await Promise.all(
    dogs.map(async (dog) => {
      const [reminders, last, activity] = await Promise.all([
        getReminders(db, dog.id),
        getLastPottyLog(db, dog.id),
        getLastActivity(db, dog.id),
      ]);
      return { dog, reminders: reminders.filter((r) => r.enabled), last, activity };
    }),
  );

  // Los de hora fija primero; el espacio que queda se reparte entre los avisos de baño de cada mascota.
  const fixedCount = perDog.reduce((n, d) => n + d.reminders.filter((r) => !r.interval_min).length, 0);
  const intervalCount = perDog.reduce((n, d) => n + d.reminders.filter((r) => r.interval_min).length, 0);
  const pottyBudget = intervalCount ? Math.max(4, Math.floor((maxPending - fixedCount) / intervalCount)) : 0;
  const now = new Date();
  const jobs: Jobs = { once: [], daily: [] };

  for (const { dog, reminders, last, activity } of perDog) {
    // Salida ~15 min después de comer, si la mascota tiene activado el aviso de baño.
    const hint = routineHint(activity, last, now);
    if (hint?.kind === 'meal' && !hint.due && reminders.some((r) => r.interval_min)) {
      jobs.once.push({ at: hint.outingAt, title: 'Salida después de comer 🍽️', body: `Ya pasaron unos 15 minutos desde que ${dog.name} comió. ¡Afuera!` });
    }
    for (const r of reminders) {
      if (r.interval_min) {
        const slots = pottySlots({
          lastLog: last ? new Date(last.logged_at) : null,
          now,
          intervalMin: r.interval_min,
          quietStart: parseTime(r.quiet_start),
          quietEnd: parseTime(r.quiet_end),
          max: Math.min(40, pottyBudget),
        });
        for (const slot of slots) jobs.once.push({ at: slot.at, ...pottyContent(dog, r, slot) });
      } else {
        const minutes = parseTime(r.time_of_day);
        if (minutes != null) jobs.daily.push({ minutes, ...fixedContent(dog, r) });
      }
    }
  }
  return jobs;
}

/** iOS guarda como máximo 64 avisos pendientes; dejamos margen. */
const MAX_NATIVE = 60;
/** En la web cada aviso es un mensaje de QStash: alcanza con las próximas ~24 h. */
const MAX_WEB = 30;
const WEB_HORIZON_MS = 24 * 60 * 60 * 1000;

async function scheduleNative(db: SQLiteDatabase) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await hasNotificationPermission(db))) return;
  const jobs = await buildJobs(db, MAX_NATIVE);
  for (const j of jobs.once) {
    await Notifications.scheduleNotificationAsync({
      content: { title: j.title, body: j.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: j.at },
    });
  }
  for (const j of jobs.daily) {
    await Notifications.scheduleNotificationAsync({
      content: { title: j.title, body: j.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: Math.floor(j.minutes / 60), minute: j.minutes % 60 },
    });
  }
}

async function scheduleWeb(db: SQLiteDatabase) {
  if ((await webPushStatus(db)) !== 'on') return;
  const jobs = await buildJobs(db, MAX_WEB);
  const now = new Date();
  const list: WebJob[] = [...jobs.once, ...jobs.daily.map((d) => ({ at: nextAtTime(now, d.minutes), title: d.title, body: d.body }))]
    .filter((j) => j.at.getTime() - now.getTime() < WEB_HORIZON_MS)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_WEB);
  await scheduleWebPush(db, list);
}

let queue: Promise<void> = Promise.resolve();

/**
 * Vuelve a programar todos los avisos desde la base de datos. Se llama al abrir la app,
 * al registrar o borrar un baño y al editar recordatorios. Las llamadas van en fila para
 * que dos sincronizaciones seguidas no dupliquen avisos.
 */
export function syncReminders(db: SQLiteDatabase): Promise<void> {
  if (!native && !web) return Promise.resolve();
  queue = queue
    .then(() => (native ? scheduleNative(db) : scheduleWeb(db)))
    .catch((e) => console.warn('No se pudieron programar los recordatorios', e));
  return queue;
}
