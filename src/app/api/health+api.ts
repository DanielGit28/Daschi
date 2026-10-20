import { getPool } from '../../server/pg';

/** GET /api/health — comprueba que el servidor llega a Neon. */
export async function GET() {
  const { rows } = await getPool().query<{ now: string; dogs: string }>(
    "SELECT now()::text AS now, (SELECT count(*) FROM dogs WHERE deleted = 0)::text AS dogs",
  );
  return Response.json({ ok: true, database: 'neon', now: rows[0].now, dogs: Number(rows[0].dogs) });
}
