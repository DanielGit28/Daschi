import { getPool } from '../../server/pg';
import { BadRequest, parseSyncRequest, syncDog } from '../../server/sync';

/** POST /api/sync — sube los cambios de una mascota y devuelve lo nuevo desde su cursor. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  try {
    return Response.json(await syncDog(getPool(), parseSyncRequest(body)));
  } catch (e) {
    if (e instanceof BadRequest) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
