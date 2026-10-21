// Notificaciones en la web (Web Push). En iPhone solo funcionan con Dachsi agregado a la pantalla de inicio.
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { getAppState, setAppState } from './db';
import { apiUrl } from './sync';

const ENDPOINT_KEY = 'push_endpoint';
const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

export type WebPushStatus = 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied';

function supported() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** En iPhone/iPad, Web Push solo existe si la web se abrió desde la pantalla de inicio. */
function isIosBrowserTab() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export async function webPushStatus(db: SQLiteDatabase): Promise<WebPushStatus> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';
  if (!supported()) return isIosBrowserTab() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (await getAppState(db, ENDPOINT_KEY)) && Notification.permission === 'granted' ? 'on' : 'off';
}

function base64UrlToUint8Array(base64Url: string) {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Pide permiso y suscribe este navegador. Llamar desde un toque del usuario (Safari lo exige). */
export async function enableWebPush(db: SQLiteDatabase): Promise<boolean> {
  if (!supported() || !VAPID_PUBLIC_KEY) return false;
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY) }));

  const res = await fetch(apiUrl('/api/push/subscribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!res.ok) return false;
  await setAppState(db, ENDPOINT_KEY, subscription.endpoint);
  return true;
}

export async function disableWebPush(db: SQLiteDatabase) {
  const endpoint = await getAppState(db, ENDPOINT_KEY);
  if (!endpoint) return;
  await fetch(apiUrl('/api/push/subscribe'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
  const registration = await navigator.serviceWorker?.getRegistration('/sw.js');
  await (await registration?.pushManager.getSubscription())?.unsubscribe();
  await setAppState(db, ENDPOINT_KEY, null);
}

export type WebJob = { at: Date; title: string; body: string };

/** Huella corta de la lista de avisos, para que el servidor no reagende si no cambió. */
function hashJobs(jobs: WebJob[]) {
  let h = 2166136261;
  for (const c of jobs.map((j) => `${j.at.toISOString()}|${j.title}|${j.body}`).join('\n')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** Manda al servidor los avisos de las próximas horas de este navegador (si tiene notificaciones activas). */
export async function scheduleWebPush(db: SQLiteDatabase, jobs: WebJob[]) {
  const endpoint = await getAppState(db, ENDPOINT_KEY);
  if (!endpoint || !supported() || Notification.permission !== 'granted') return;
  await fetch(apiUrl('/api/push/schedule'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, hash: hashJobs(jobs), jobs: jobs.map((j) => ({ ...j, at: j.at.toISOString() })) }),
  });
}
