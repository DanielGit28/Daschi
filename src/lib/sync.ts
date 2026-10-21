// Sincronización de la app con el servidor: cada dispositivo trabaja con su SQLite local y,
// cuando hay conexión, sube lo pendiente (dirty = 1) y baja lo nuevo. Gana el updated_at más reciente.
import type { SQLiteDatabase } from 'expo-sqlite';
import { getAppState, setAppState } from './db';
import {
  SYNC_TABLE_NAMES,
  wireColumns,
  type PublicDog,
  type SyncChanges,
  type SyncRequest,
  type SyncResponse,
  type SyncRow,
  type SyncTable,
} from './sync-schema';

export type Transport = (req: SyncRequest) => Promise<SyncResponse>;

/**
 * En web y en desarrollo las rutas relativas llegan al mismo servidor de Expo.
 * Para la app nativa en producción se define EXPO_PUBLIC_API_URL (por ejemplo, la URL de Vercel).
 */
export function apiUrl(path: string) {
  const base = process.env.EXPO_PUBLIC_API_URL;
  return base ? `${base.replace(/\/$/, '')}${path}` : path;
}

export const httpTransport: Transport = async (req) => {
  const res = await fetch(apiUrl('/api/sync'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Sync ${res.status}: ${await res.text()}`);
  return (await res.json()) as SyncResponse;
};

export async function fetchPublicDogs(): Promise<PublicDog[]> {
  const res = await fetch(apiUrl('/api/dogs'));
  if (!res.ok) throw new Error(`Dogs ${res.status}`);
  return ((await res.json()) as { dogs: PublicDog[] }).dogs;
}

const cursorKey = (dogId: string) => `sync_cursor:${dogId}`;
const ownerColumn = (table: SyncTable) => (table === 'dogs' ? 'id' : 'dog_id');

/** Sincroniza una mascota. Devuelve cuántas filas llegaron con cambios desde el servidor. */
export async function syncDogData(db: SQLiteDatabase, dogId: string, transport: Transport): Promise<number> {
  const cursor = Number((await getAppState(db, cursorKey(dogId))) ?? 0);

  const changes: SyncChanges = {};
  for (const table of SYNC_TABLE_NAMES) {
    const rows = await db.getAllAsync<SyncRow>(
      `SELECT ${wireColumns(table).join(', ')} FROM ${table} WHERE ${ownerColumn(table)} = ? AND dirty = 1`,
      dogId,
    );
    if (rows.length) changes[table] = rows;
  }

  const res = await transport({ dogId, cursor, changes });

  let applied = 0;
  await db.withTransactionAsync(async () => {
    // Lo subido queda limpio, salvo que haya cambiado otra vez mientras viajaba.
    for (const table of SYNC_TABLE_NAMES) {
      for (const row of changes[table] ?? []) {
        await db.runAsync(`UPDATE ${table} SET dirty = 0 WHERE id = ? AND updated_at = ?`, row.id, row.updated_at);
      }
    }
    // Lo que bajó se aplica solo si es más nuevo que lo local.
    for (const table of SYNC_TABLE_NAMES) {
      const cols = wireColumns(table);
      const sql = `INSERT INTO ${table} (${cols.join(', ')}, dirty) VALUES (${cols.map(() => '?').join(', ')}, 0)
        ON CONFLICT(id) DO UPDATE SET ${cols
          .filter((c) => c !== 'id')
          .map((c) => `${c} = excluded.${c}`)
          .join(', ')}, dirty = 0
        WHERE excluded.updated_at > ${table}.updated_at`;
      for (const row of res.changes[table] ?? []) {
        const result = await db.runAsync(sql, ...cols.map((c) => row[c] ?? null));
        applied += result.changes;
      }
    }
    await setAppState(db, cursorKey(dogId), String(res.cursor));
  });
  return applied;
}

/** Sincroniza todas las mascotas de este dispositivo (incluidas las borradas, para subir el borrado). */
export async function syncAll(db: SQLiteDatabase, transport: Transport = httpTransport): Promise<number> {
  const dogs = await db.getAllAsync<{ id: string }>('SELECT id FROM dogs');
  let applied = 0;
  for (const { id } of dogs) applied += await syncDogData(db, id, transport);
  return applied;
}

/** Trae una mascota registrada en otro dispositivo (perfil público) con todo su historial. */
export async function adoptDog(db: SQLiteDatabase, dogId: string, transport: Transport = httpTransport) {
  await setAppState(db, cursorKey(dogId), '0');
  return syncDogData(db, dogId, transport);
}
