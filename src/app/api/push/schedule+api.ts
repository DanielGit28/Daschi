import { getPool } from '../../../server/pg';
import { scheduleJobs, type PushJob } from '../../../server/push';

/**
 * POST /api/push/schedule — reemplaza los avisos agendados de este navegador.
 * Body: { endpoint, hash, jobs: [{ at, title, body }] }. Los calcula el dispositivo (sabe su zona horaria).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown; hash?: unknown; jobs?: unknown } | null;
  const { endpoint, hash, jobs } = body ?? {};
  if (typeof endpoint !== 'string' || typeof hash !== 'string' || !Array.isArray(jobs)) {
    return Response.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  const clean: PushJob[] = jobs
    .filter((j): j is PushJob => typeof j?.at === 'string' && typeof j?.title === 'string' && typeof j?.body === 'string')
    .slice(0, 100);

  // QStash tiene que poder llamar de vuelta: se usa el dominio de producción (los deploys de preview
  // piden login de Vercel). En desarrollo local (localhost) no se agenda nada.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = production ? `https://${production}` : new URL(request.url).origin;
  if (/localhost|127\.0\.0\.1|192\.168\./.test(origin)) return Response.json({ status: 'skipped-local' });

  return Response.json(await scheduleJobs(getPool(), endpoint, hash, clean, origin));
}
