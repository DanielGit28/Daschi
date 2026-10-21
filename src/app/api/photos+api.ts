import { put } from '@vercel/blob';
import { getPool } from '../../server/pg';

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * POST /api/photos — sube una foto (ya achicada en el dispositivo) a Vercel Blob y devuelve su URL.
 * Body: { dogId, contentType, base64 }. La fila de la foto la crea el dispositivo y viaja por /api/sync.
 */
export async function POST(request: Request) {
  let body: { dogId?: unknown; contentType?: unknown; base64?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { dogId, contentType, base64 } = body;
  if (typeof dogId !== 'string' || !dogId || dogId.length > 100) return Response.json({ error: 'dogId inválido.' }, { status: 400 });
  if (typeof contentType !== 'string' || !TYPES[contentType]) return Response.json({ error: 'Tipo de imagen no soportado.' }, { status: 400 });
  if (typeof base64 !== 'string' || !base64) return Response.json({ error: 'Falta la imagen.' }, { status: 400 });

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_BYTES) return Response.json({ error: 'La foto es demasiado grande.' }, { status: 413 });

  // Solo mascotas que ya existen en el servidor (evita usar el almacenamiento para cualquier cosa).
  const { rowCount } = await getPool().query('SELECT 1 FROM dogs WHERE id = $1 AND deleted = 0', [dogId]);
  if (!rowCount) return Response.json({ error: 'La mascota todavía no está sincronizada.' }, { status: 404 });

  const blob = await put(`dogs/${dogId}/${Date.now()}.${TYPES[contentType]}`, bytes, {
    access: 'public',
    contentType,
    addRandomSuffix: true,
  });
  return Response.json({ url: blob.url });
}
