// Notificaciones en la web: el navegador se suscribe (Web Push), el dispositivo manda los avisos de las
// próximas horas y QStash los entrega a /api/push/send a la hora exacta, que manda el Web Push.
import { Client, Receiver } from '@upstash/qstash';
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import webpush from 'web-push';

export type PushJob = { at: string; title: string; body: string };

const MAX_JOBS = 40;
const HORIZON_MS = 36 * 60 * 60 * 1000;

let configured = false;
function configureWebPush() {
  if (configured) return;
  const publicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('Faltan las claves VAPID en el entorno.');
  webpush.setVapidDetails('https://dachsi.vercel.app', publicKey, privateKey);
  configured = true;
}

function qstash() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error('Falta QSTASH_TOKEN en el entorno.');
  return new Client({ token, baseUrl: process.env.QSTASH_URL });
}

export type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export function parseSubscription(body: unknown): SubscriptionInput | null {
  const sub = (body as { subscription?: SubscriptionInput } | null)?.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://')) return null;
  if (typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') return null;
  return sub;
}

export async function saveSubscription(pool: Pool, sub: SubscriptionInput) {
  const label = `dachsi-${createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 24)}`;
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, label) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, updated_at = now()`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, label],
  );
}

export async function deleteSubscription(pool: Pool, endpoint: string) {
  const { rows } = await pool.query<{ label: string }>('DELETE FROM push_subscriptions WHERE endpoint = $1 RETURNING label', [endpoint]);
  if (rows[0]) await qstash().messages.cancel({ filter: { label: rows[0].label } });
}

/**
 * Reemplaza los avisos agendados de un dispositivo. Si la huella no cambió, no hace nada
 * (cada apertura de la app manda la lista, y así no gastamos mensajes de QStash).
 */
export async function scheduleJobs(pool: Pool, endpoint: string, hash: string, jobs: PushJob[], callbackOrigin: string) {
  const { rows } = await pool.query<{ label: string; jobs_hash: string | null }>(
    'SELECT label, jobs_hash FROM push_subscriptions WHERE endpoint = $1',
    [endpoint],
  );
  const sub = rows[0];
  if (!sub) return { status: 'unknown-subscription' as const };
  if (sub.jobs_hash === hash) return { status: 'unchanged' as const };

  const client = qstash();
  await client.messages.cancel({ filter: { label: sub.label } });

  const now = Date.now();
  const upcoming = jobs
    .map((j) => ({ ...j, ms: Date.parse(j.at) }))
    .filter((j) => Number.isFinite(j.ms) && j.ms > now + 30_000 && j.ms < now + HORIZON_MS)
    .sort((a, b) => a.ms - b.ms)
    .slice(0, MAX_JOBS);

  for (const job of upcoming) {
    await client.publishJSON({
      url: `${callbackOrigin}/api/push/send`,
      body: { endpoint, title: job.title.slice(0, 120), body: job.body.slice(0, 300) },
      notBefore: Math.floor(job.ms / 1000),
      label: sub.label,
      retries: 2,
    });
  }
  await pool.query('UPDATE push_subscriptions SET jobs_hash = $2, updated_at = now() WHERE endpoint = $1', [endpoint, hash]);
  return { status: 'scheduled' as const, count: upcoming.length };
}

/** Verifica que el pedido viene de QStash (firma en el header upstash-signature). */
export async function verifyQStash(request: Request, rawBody: string) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const signature = request.headers.get('upstash-signature');
  if (!currentSigningKey || !nextSigningKey || !signature) return false;
  try {
    return await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature, body: rawBody });
  } catch {
    return false;
  }
}

/** Manda un Web Push. Si el navegador ya no acepta la suscripción (404/410), la borra. */
export async function sendPush(pool: Pool, endpoint: string, title: string, body: string) {
  configureWebPush();
  const { rows } = await pool.query<{ p256dh: string; auth: string }>('SELECT p256dh, auth FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  if (!rows[0]) return 'gone';
  try {
    await webpush.sendNotification({ endpoint, keys: rows[0] }, JSON.stringify({ title, body }), { TTL: 60 * 60 });
    return 'sent';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
      return 'gone';
    }
    throw e;
  }
}
