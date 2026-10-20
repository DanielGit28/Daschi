// Lógica de sincronización en el servidor (Postgres). Sin dependencias de Expo para poder probarla.
import type { Pool, PoolClient } from 'pg';
import {
  SYNC_TABLE_NAMES,
  wireColumns,
  type PublicDog,
  type SyncChanges,
  type SyncRequest,
  type SyncResponse,
  type SyncRow,
  type SyncTable,
} from '../lib/sync-schema';

const MAX_ROWS_PER_REQUEST = 5000;

export class BadRequest extends Error {}

const isText = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Valida el pedido: solo tablas y columnas conocidas, y todas las filas de la mascota indicada. */
export function parseSyncRequest(body: unknown): SyncRequest {
  if (!body || typeof body !== 'object') throw new BadRequest('Pedido vacío.');
  const { dogId, cursor, changes } = body as Record<string, unknown>;
  if (!isText(dogId, 100)) throw new BadRequest('dogId inválido.');
  if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0) throw new BadRequest('cursor inválido.');
  if (changes != null && typeof changes !== 'object') throw new BadRequest('changes inválido.');

  const clean: SyncChanges = {};
  let total = 0;
  for (const [table, rows] of Object.entries((changes ?? {}) as Record<string, unknown>)) {
    if (!SYNC_TABLE_NAMES.includes(table as SyncTable)) throw new BadRequest(`Tabla desconocida: ${table}`);
    if (!Array.isArray(rows)) throw new BadRequest(`${table} debe ser una lista.`);
    total += rows.length;
    if (total > MAX_ROWS_PER_REQUEST) throw new BadRequest('Demasiados cambios en un pedido.');
    const cols = wireColumns(table as SyncTable);
    clean[table as SyncTable] = rows.map((raw) => {
      if (!raw || typeof raw !== 'object') throw new BadRequest(`Fila inválida en ${table}.`);
      const row: SyncRow = {};
      for (const c of cols) {
        const v = (raw as Record<string, unknown>)[c];
        if (v != null && typeof v !== 'string' && typeof v !== 'number') throw new BadRequest(`${table}.${c} inválido.`);
        row[c] = (v ?? null) as SyncRow[string];
      }
      if (!isText(row.id, 200) || !isText(row.updated_at, 40)) throw new BadRequest(`${table}: falta id o updated_at.`);
      // Cada pedido solo puede tocar datos de su mascota.
      const owner = table === 'dogs' ? row.id : row.dog_id;
      if (owner !== dogId) throw new BadRequest(`${table}: la fila no pertenece a la mascota.`);
      row.deleted = row.deleted ? 1 : 0;
      return row;
    });
  }
  return { dogId, cursor, changes: clean };
}

async function upsertRows(client: PoolClient, table: SyncTable, rows: SyncRow[]) {
  const cols = wireColumns(table);
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
    ON CONFLICT (id) DO UPDATE SET ${cols
      .filter((c) => c !== 'id')
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(', ')}, seq = nextval('sync_seq')
    WHERE ${table}.updated_at < EXCLUDED.updated_at`;
  for (const row of rows) await client.query(sql, cols.map((c) => row[c] ?? null));
}

/** Sube los cambios de una mascota (gana el updated_at más reciente) y devuelve lo nuevo desde `cursor`. */
export async function syncDog(pool: Pool, req: SyncRequest): Promise<SyncResponse> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of SYNC_TABLE_NAMES) {
      const rows = req.changes[table];
      if (rows?.length) await upsertRows(client, table, rows);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  let cursor = req.cursor;
  const changes: SyncChanges = {};
  for (const table of SYNC_TABLE_NAMES) {
    const owner = table === 'dogs' ? 'id' : 'dog_id';
    const { rows } = await pool.query<SyncRow & { seq: string }>(
      `SELECT ${wireColumns(table).join(', ')}, seq::text AS seq FROM ${table} WHERE ${owner} = $1 AND seq > $2 ORDER BY seq`,
      [req.dogId, req.cursor],
    );
    if (!rows.length) continue;
    changes[table] = rows.map(({ seq, ...row }) => {
      cursor = Math.max(cursor, Number(seq));
      return row;
    });
  }
  return { cursor, changes };
}

/** Perfiles públicos para elegir mascota desde otro dispositivo. */
export async function listDogs(pool: Pool): Promise<PublicDog[]> {
  const { rows } = await pool.query<PublicDog>(
    'SELECT id, name, breed, birth_date FROM dogs WHERE deleted = 0 ORDER BY lower(name)',
  );
  return rows;
}
