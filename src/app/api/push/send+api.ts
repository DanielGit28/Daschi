import { getPool } from '../../../server/pg';
import { sendPush, verifyQStash } from '../../../server/push';

/** POST /api/push/send — lo llama QStash a la hora agendada; manda el Web Push al navegador. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!(await verifyQStash(request, raw))) return Response.json({ error: 'Firma inválida.' }, { status: 401 });

  const { endpoint, title, body } = JSON.parse(raw) as { endpoint: string; title: string; body: string };
  const result = await sendPush(getPool(), endpoint, title, body);
  return Response.json({ result });
}
