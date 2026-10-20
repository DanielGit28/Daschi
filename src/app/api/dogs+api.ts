import { getPool } from '../../server/pg';
import { listDogs } from '../../server/sync';

/** GET /api/dogs — perfiles públicos de mascotas, para elegir una desde otro dispositivo. */
export async function GET() {
  return Response.json({ dogs: await listDogs(getPool()) });
}
