import { getPool } from '../../../server/pg';
import { deleteSubscription, parseSubscription, saveSubscription } from '../../../server/push';

/** POST /api/push/subscribe — guarda la suscripción Web Push de este navegador. */
export async function POST(request: Request) {
  const sub = parseSubscription(await request.json().catch(() => null));
  if (!sub) return Response.json({ error: 'Suscripción inválida.' }, { status: 400 });
  await saveSubscription(getPool(), sub);
  return Response.json({ ok: true });
}

/** DELETE /api/push/subscribe — apaga las notificaciones de este navegador y cancela lo agendado. */
export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== 'string') return Response.json({ error: 'Falta endpoint.' }, { status: 400 });
  await deleteSubscription(getPool(), body.endpoint);
  return Response.json({ ok: true });
}
