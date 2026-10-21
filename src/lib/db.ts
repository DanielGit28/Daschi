import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { GoalId, Household, PottySpot } from '../content';
import { emitLocalChange } from './changes';
import { SYNC_TABLES, SYNC_TABLE_NAMES, type SyncTable } from './sync-schema';

export const DATABASE_NAME = 'dachsi.db';

/**
 * Todas las tablas sincronizables tienen:
 * - id TEXT (UUID, o id fijo "perro:cosa" en las tablas de marcas para no duplicar entre dispositivos)
 * - updated_at: último cambio (ISO), gana el más reciente al sincronizar
 * - deleted: borrado suave, para que borrar también viaje entre dispositivos
 * - dirty: 1 si hay cambios locales sin subir
 */
type SyncFields = { updated_at: string; deleted: number; dirty: number };

export type Dog = SyncFields & {
  id: string;
  name: string;
  breed: string;
  birth_date: string; // AAAA-MM-DD
  weight_kg: number | null;
  photo_uri: string | null;
  created_at: string;
  /** Día en que llega (o llegó) a casa, AAAA-MM-DD. */
  arrival_date: string | null;
  potty_spot: PottySpot | null;
  daily_minutes: number | null;
  household: Household | null;
  /** 1 cuando ya respondió las preguntas de enfoques. */
  setup_done: number;
  sex: Sex | null;
};

export type Sex = 'macho' | 'hembra';

export type PottyKind = 'pipi' | 'popo';
export type PottyPlace = 'fuera' | 'dentro';

export type PottyLog = SyncFields & {
  id: string;
  dog_id: string;
  kind: PottyKind;
  place: PottyPlace;
  logged_at: string; // ISO
  note: string | null;
};

export type ReminderKind = 'bano' | 'comida' | 'siesta' | 'sesion';

export type Reminder = SyncFields & {
  id: string;
  dog_id: string;
  kind: ReminderKind;
  label: string;
  // Si interval_min tiene valor, se repite cada N minutos; si no, a la hora fija time_of_day (HH:MM).
  interval_min: number | null;
  time_of_day: string | null;
  enabled: number; // 0 | 1
  // Silencio de noche (HH:MM) para los recordatorios por intervalo.
  quiet_start: string | null;
  quiet_end: string | null;
};

export type SessionLog = SyncFields & {
  id: string;
  dog_id: string;
  lesson_id: string;
  logged_at: string;
  reps: number | null;
  rating: number | null;
  note: string | null;
};

export type Reaction = 'bien' | 'dudosa' | 'miedo';

export type SocializationLog = SyncFields & {
  id: string;
  dog_id: string;
  item_id: string;
  logged_at: string;
  reaction: Reaction;
};

export const DEFAULT_QUIET_START = '22:00';
export const DEFAULT_QUIET_END = '06:00';

const DATABASE_VERSION = 6;

const now = () => new Date().toISOString();

/** UUID v4 generado dentro de SQLite (para migrar filas existentes). */
const SQL_UUID = `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))`;

export { SYNC_TABLES, SYNC_TABLE_NAMES, type SyncTable };

/**
 * Migraciones con PRAGMA user_version: cada versión nueva agrega un bloque
 * `if (current < N)` sin tocar los anteriores, así los datos de la cachorra
 * sobreviven a cada actualización de la app.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE IF NOT EXISTS dogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        breed TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        weight_kg REAL,
        photo_uri TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS potty_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('pipi','popo')),
        place TEXT NOT NULL CHECK (place IN ('fuera','dentro')),
        logged_at TEXT NOT NULL,
        note TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_potty_dog_time ON potty_logs(dog_id, logged_at);

      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('bano','comida','siesta','sesion')),
        label TEXT NOT NULL,
        interval_min INTEGER,
        time_of_day TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        notification_id TEXT
      );
    `);
    current = 1;
  }

  if (current < 2) {
    await db.execAsync(`
      ALTER TABLE reminders ADD COLUMN quiet_start TEXT;
      ALTER TABLE reminders ADD COLUMN quiet_end TEXT;
      UPDATE reminders SET quiet_start = '${DEFAULT_QUIET_START}', quiet_end = '${DEFAULT_QUIET_END}' WHERE interval_min IS NOT NULL;
    `);
    current = 2;
  }

  if (current < 3) {
    await db.execAsync(`
      ALTER TABLE dogs ADD COLUMN arrival_date TEXT;
      ALTER TABLE dogs ADD COLUMN potty_spot TEXT;
      ALTER TABLE dogs ADD COLUMN daily_minutes INTEGER;
      ALTER TABLE dogs ADD COLUMN household TEXT;
      ALTER TABLE dogs ADD COLUMN setup_done INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS dog_goals (
        dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
        goal TEXT NOT NULL,
        PRIMARY KEY (dog_id, goal)
      );

      CREATE TABLE IF NOT EXISTS checklist_done (
        dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        done_at TEXT NOT NULL,
        PRIMARY KEY (dog_id, item_id)
      );

      CREATE TABLE IF NOT EXISTS session_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        reps INTEGER,
        rating INTEGER,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS socialization_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        reaction TEXT NOT NULL CHECK (reaction IN ('bien','dudosa','miedo'))
      );
    `);
    current = 3;
  }

  if (current < 4) {
    // Ids enteros → UUID y campos de sincronización. Las filas se copian a tablas nuevas
    // traduciendo dog_id; todo en una transacción para no quedar a medias.
    const sync = `updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1`;
    const ts = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
    const dogUuid = (alias: string) => `(SELECT uuid FROM dogs WHERE dogs.id = ${alias}.dog_id)`;
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      BEGIN;

      ALTER TABLE dogs ADD COLUMN uuid TEXT;
      UPDATE dogs SET uuid = ${SQL_UUID};

      CREATE TABLE dogs_v4 (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, breed TEXT NOT NULL, birth_date TEXT NOT NULL,
        weight_kg REAL, photo_uri TEXT, created_at TEXT NOT NULL, arrival_date TEXT, potty_spot TEXT,
        daily_minutes INTEGER, household TEXT, setup_done INTEGER NOT NULL DEFAULT 0, ${sync}
      );
      INSERT INTO dogs_v4 SELECT uuid, name, breed, birth_date, weight_kg, photo_uri, created_at, arrival_date,
        potty_spot, daily_minutes, household, setup_done, ${ts}, 0, 1 FROM dogs;

      CREATE TABLE potty_logs_v4 (
        id TEXT PRIMARY KEY, dog_id TEXT NOT NULL, kind TEXT NOT NULL, place TEXT NOT NULL,
        logged_at TEXT NOT NULL, note TEXT, ${sync}
      );
      INSERT INTO potty_logs_v4 SELECT ${SQL_UUID}, ${dogUuid('p')}, kind, place, logged_at, note, ${ts}, 0, 1 FROM potty_logs p;

      CREATE TABLE reminders_v4 (
        id TEXT PRIMARY KEY, dog_id TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL,
        interval_min INTEGER, time_of_day TEXT, enabled INTEGER NOT NULL DEFAULT 1,
        quiet_start TEXT, quiet_end TEXT, ${sync}
      );
      INSERT INTO reminders_v4 SELECT ${SQL_UUID}, ${dogUuid('r')}, kind, label, interval_min, time_of_day, enabled,
        quiet_start, quiet_end, ${ts}, 0, 1 FROM reminders r;

      CREATE TABLE dog_goals_v4 (id TEXT PRIMARY KEY, dog_id TEXT NOT NULL, goal TEXT NOT NULL, ${sync});
      INSERT INTO dog_goals_v4 SELECT ${dogUuid('g')} || ':' || goal, ${dogUuid('g')}, goal, ${ts}, 0, 1 FROM dog_goals g;

      CREATE TABLE checklist_done_v4 (id TEXT PRIMARY KEY, dog_id TEXT NOT NULL, item_id TEXT NOT NULL, done_at TEXT NOT NULL, ${sync});
      INSERT INTO checklist_done_v4 SELECT ${dogUuid('c')} || ':' || item_id, ${dogUuid('c')}, item_id, done_at, ${ts}, 0, 1 FROM checklist_done c;

      CREATE TABLE session_logs_v4 (
        id TEXT PRIMARY KEY, dog_id TEXT NOT NULL, lesson_id TEXT NOT NULL, logged_at TEXT NOT NULL,
        reps INTEGER, rating INTEGER, note TEXT, ${sync}
      );
      INSERT INTO session_logs_v4 SELECT ${SQL_UUID}, ${dogUuid('s')}, lesson_id, logged_at, reps, rating, note, ${ts}, 0, 1 FROM session_logs s;

      CREATE TABLE socialization_logs_v4 (
        id TEXT PRIMARY KEY, dog_id TEXT NOT NULL, item_id TEXT NOT NULL, logged_at TEXT NOT NULL, reaction TEXT NOT NULL, ${sync}
      );
      INSERT INTO socialization_logs_v4 SELECT ${SQL_UUID}, ${dogUuid('x')}, item_id, logged_at, reaction, ${ts}, 0, 1 FROM socialization_logs x;

      DROP TABLE potty_logs; DROP TABLE reminders; DROP TABLE dog_goals; DROP TABLE checklist_done;
      DROP TABLE session_logs; DROP TABLE socialization_logs; DROP TABLE dogs;
      ALTER TABLE dogs_v4 RENAME TO dogs;
      ALTER TABLE potty_logs_v4 RENAME TO potty_logs;
      ALTER TABLE reminders_v4 RENAME TO reminders;
      ALTER TABLE dog_goals_v4 RENAME TO dog_goals;
      ALTER TABLE checklist_done_v4 RENAME TO checklist_done;
      ALTER TABLE session_logs_v4 RENAME TO session_logs;
      ALTER TABLE socialization_logs_v4 RENAME TO socialization_logs;

      CREATE INDEX idx_potty_dog_time ON potty_logs(dog_id, logged_at);
      CREATE INDEX idx_session_dog_lesson ON session_logs(dog_id, lesson_id, logged_at);
      CREATE INDEX idx_social_dog ON socialization_logs(dog_id, item_id);
      CREATE INDEX idx_reminders_dog ON reminders(dog_id);

      -- Estado de este dispositivo (mascota elegida, cursor de sincronización). No se sincroniza.
      CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT);
      INSERT INTO app_state (key, value) SELECT 'current_dog_id', id FROM dogs ORDER BY created_at LIMIT 1;

      PRAGMA user_version = 4;
      COMMIT;
    `);
    current = 4;
  }

  if (current < 5) {
    await db.execAsync(`
      ALTER TABLE dogs ADD COLUMN sex TEXT;

      CREATE TABLE activity_logs (
        id TEXT PRIMARY KEY, dog_id TEXT NOT NULL, kind TEXT NOT NULL, logged_at TEXT NOT NULL, note TEXT,
        updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX idx_activity_dog_time ON activity_logs(dog_id, logged_at);
    `);
    current = 5;
  }

  if (current < 6) {
    await db.execAsync(`
      CREATE TABLE photos (
        id TEXT PRIMARY KEY, dog_id TEXT NOT NULL, url TEXT NOT NULL, taken_at TEXT NOT NULL, caption TEXT,
        level_id TEXT, width INTEGER, height INTEGER,
        updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX idx_photos_dog_time ON photos(dog_id, taken_at);
    `);
    current = 6;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

// ---------- Estado del dispositivo ----------

export async function getAppState(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM app_state WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setAppState(db: SQLiteDatabase, key: string, value: string | null) {
  await db.runAsync('INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

// ---------- Escrituras sincronizables ----------

type Value = string | number | null;

/** Inserta o reemplaza una fila marcándola como cambio local. */
async function upsert(db: SQLiteDatabase, table: SyncTable, row: Record<string, Value>) {
  const full = { ...row, updated_at: now(), deleted: row.deleted ?? 0, dirty: 1 };
  const cols = Object.keys(full);
  await db.runAsync(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')}`,
    ...cols.map((c) => (full as Record<string, Value>)[c]),
  );
  emitLocalChange();
}

async function patchRow(db: SQLiteDatabase, table: SyncTable, id: string, patch: Record<string, Value>) {
  const full = { ...patch, updated_at: now(), dirty: 1 };
  const cols = Object.keys(full);
  await db.runAsync(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => full[c as keyof typeof full] as Value), id);
  emitLocalChange();
}

const softDelete = (db: SQLiteDatabase, table: SyncTable, id: string) => patchRow(db, table, id, { deleted: 1 });

// ---------- Mascotas ----------

export function getDogs(db: SQLiteDatabase) {
  return db.getAllAsync<Dog>('SELECT * FROM dogs WHERE deleted = 0 ORDER BY name COLLATE NOCASE');
}

export function getDogById(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Dog>('SELECT * FROM dogs WHERE id = ? AND deleted = 0', id);
}

export type DogInput = {
  name: string;
  breed: string;
  birth_date: string;
  weight_kg: number | null;
  sex: Sex | null;
};

export async function createDog(db: SQLiteDatabase, input: DogInput) {
  const id = randomUUID();
  await upsert(db, 'dogs', { id, ...input, photo_uri: null, created_at: now(), setup_done: 0 });
  await seedDefaultReminders(db, id);
  return id;
}

export async function updateDog(db: SQLiteDatabase, id: string, input: DogInput) {
  await patchRow(db, 'dogs', id, input);
}

/** Borra el perfil (y, al sincronizar, en todos los dispositivos). */
export async function deleteDog(db: SQLiteDatabase, id: string) {
  await softDelete(db, 'dogs', id);
}

export type DogSetup = {
  arrival_date: string;
  potty_spot: PottySpot;
  daily_minutes: number;
  household: Household;
  goals: GoalId[];
};

/** Respuestas de las preguntas de enfoques. */
export async function saveDogSetup(db: SQLiteDatabase, dogId: string, setup: DogSetup) {
  await db.withTransactionAsync(async () => {
    const { goals, ...fields } = setup;
    await patchRow(db, 'dogs', dogId, { ...fields, setup_done: 1 });
    const existing = await db.getAllAsync<{ id: string; goal: string; deleted: number }>('SELECT id, goal, deleted FROM dog_goals WHERE dog_id = ?', dogId);
    for (const row of existing) {
      const keep = goals.includes(row.goal as GoalId);
      if (row.deleted === (keep ? 0 : 1)) continue;
      await patchRow(db, 'dog_goals', row.id, { deleted: keep ? 0 : 1 });
    }
    for (const goal of goals) {
      if (!existing.some((r) => r.goal === goal)) await upsert(db, 'dog_goals', { id: `${dogId}:${goal}`, dog_id: dogId, goal });
    }
  });
}

export async function getDogGoals(db: SQLiteDatabase, dogId: string): Promise<GoalId[]> {
  const rows = await db.getAllAsync<{ goal: GoalId }>('SELECT goal FROM dog_goals WHERE dog_id = ? AND deleted = 0', dogId);
  return rows.map((r) => r.goal);
}

// ---------- Listas y progreso ----------

export async function getDoneItems(db: SQLiteDatabase, dogId: string) {
  const rows = await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM checklist_done WHERE dog_id = ? AND deleted = 0', dogId);
  return new Set(rows.map((r) => r.item_id));
}

export async function setItemDone(db: SQLiteDatabase, dogId: string, itemId: string, done: boolean) {
  // Id fijo: marcar lo mismo en dos dispositivos termina en una sola fila.
  await upsert(db, 'checklist_done', { id: `${dogId}:${itemId}`, dog_id: dogId, item_id: itemId, done_at: now(), deleted: done ? 0 : 1 });
}

export async function addSessionLog(db: SQLiteDatabase, dogId: string, lessonId: string, reps: number | null, rating: number | null) {
  await upsert(db, 'session_logs', { id: randomUUID(), dog_id: dogId, lesson_id: lessonId, logged_at: now(), reps, rating, note: null });
}

export function getSessionLogs(db: SQLiteDatabase, dogId: string, lessonId: string) {
  return db.getAllAsync<SessionLog>(
    'SELECT * FROM session_logs WHERE dog_id = ? AND lesson_id = ? AND deleted = 0 ORDER BY logged_at DESC',
    dogId,
    lessonId,
  );
}

/** Última práctica de cada lección, en ms (para el motor del plan). */
export async function getLastPracticed(db: SQLiteDatabase, dogId: string) {
  const rows = await db.getAllAsync<{ lesson_id: string; last: string }>(
    'SELECT lesson_id, MAX(logged_at) AS last FROM session_logs WHERE dog_id = ? AND deleted = 0 GROUP BY lesson_id',
    dogId,
  );
  return new Map(rows.map((r) => [r.lesson_id, new Date(r.last).getTime()]));
}

export async function addSocializationLog(db: SQLiteDatabase, dogId: string, itemId: string, reaction: Reaction) {
  await upsert(db, 'socialization_logs', { id: randomUUID(), dog_id: dogId, item_id: itemId, logged_at: now(), reaction });
}

/** Fechas de práctica (sesiones de lecciones y socialización), para la racha. */
export async function getPracticeDates(db: SQLiteDatabase, dogId: string) {
  const rows = await db.getAllAsync<{ logged_at: string }>(
    `SELECT logged_at FROM session_logs WHERE dog_id = ? AND deleted = 0
     UNION ALL SELECT logged_at FROM socialization_logs WHERE dog_id = ? AND deleted = 0`,
    dogId,
    dogId,
  );
  return rows.map((r) => r.logged_at);
}

export function getSocializationLogs(db: SQLiteDatabase, dogId: string) {
  return db.getAllAsync<SocializationLog>(
    'SELECT * FROM socialization_logs WHERE dog_id = ? AND deleted = 0 ORDER BY logged_at DESC',
    dogId,
  );
}

export async function deleteSocializationLog(db: SQLiteDatabase, id: string) {
  await softDelete(db, 'socialization_logs', id);
}

// ---------- Fotos ----------

export type Photo = SyncFields & {
  id: string;
  dog_id: string;
  /** URL pública en Vercel Blob. */
  url: string;
  taken_at: string;
  caption: string | null;
  level_id: string | null;
  width: number | null;
  height: number | null;
};

export async function addPhoto(db: SQLiteDatabase, photo: Omit<Photo, keyof SyncFields | 'id'>) {
  const id = randomUUID();
  await upsert(db, 'photos', { id, ...photo });
  return id;
}

export function getPhotos(db: SQLiteDatabase, dogId: string) {
  return db.getAllAsync<Photo>('SELECT * FROM photos WHERE dog_id = ? AND deleted = 0 ORDER BY taken_at DESC', dogId);
}

export async function deletePhoto(db: SQLiteDatabase, id: string) {
  await softDelete(db, 'photos', id);
}

// ---------- Comida y siesta ----------

export type ActivityKind = 'comida' | 'dormir' | 'despertar';

export type ActivityLog = SyncFields & {
  id: string;
  dog_id: string;
  kind: ActivityKind;
  logged_at: string;
  note: string | null;
};

export async function addActivityLog(db: SQLiteDatabase, dogId: string, kind: ActivityKind, at: Date = new Date()) {
  const id = randomUUID();
  await upsert(db, 'activity_logs', { id, dog_id: dogId, kind, logged_at: at.toISOString(), note: null });
  return id;
}

export function getActivityLogsSince(db: SQLiteDatabase, dogId: string, since: Date) {
  return db.getAllAsync<ActivityLog>(
    'SELECT * FROM activity_logs WHERE dog_id = ? AND logged_at >= ? AND deleted = 0 ORDER BY logged_at DESC',
    dogId,
    since.toISOString(),
  );
}

export function getLastActivity(db: SQLiteDatabase, dogId: string) {
  return db.getFirstAsync<ActivityLog>(
    'SELECT * FROM activity_logs WHERE dog_id = ? AND deleted = 0 ORDER BY logged_at DESC LIMIT 1',
    dogId,
  );
}

export async function deleteActivityLog(db: SQLiteDatabase, id: string) {
  await softDelete(db, 'activity_logs', id);
}

// ---------- Registros de baño ----------

export async function addPottyLog(db: SQLiteDatabase, dogId: string, kind: PottyKind, place: PottyPlace, at: Date = new Date()) {
  const id = randomUUID();
  await upsert(db, 'potty_logs', { id, dog_id: dogId, kind, place, logged_at: at.toISOString(), note: null });
  return id;
}

export function getPottyLogsSince(db: SQLiteDatabase, dogId: string, since: Date) {
  return db.getAllAsync<PottyLog>(
    'SELECT * FROM potty_logs WHERE dog_id = ? AND logged_at >= ? AND deleted = 0 ORDER BY logged_at DESC',
    dogId,
    since.toISOString(),
  );
}

export async function deletePottyLog(db: SQLiteDatabase, id: string) {
  await softDelete(db, 'potty_logs', id);
}

/** Último registro de baño (pipí o popó, dentro o fuera): desde ahí se cuenta la próxima salida. */
export function getLastPottyLog(db: SQLiteDatabase, dogId: string) {
  return db.getFirstAsync<PottyLog>(
    'SELECT * FROM potty_logs WHERE dog_id = ? AND deleted = 0 ORDER BY logged_at DESC LIMIT 1',
    dogId,
  );
}

// ---------- Recordatorios ----------

/** Recordatorios por defecto para un cachorro de ~8 semanas; empiezan apagados. */
async function seedDefaultReminders(db: SQLiteDatabase, dogId: string) {
  const defaults: Array<[ReminderKind, string, number | null, string | null]> = [
    ['bano', 'Salida al baño', 60, null],
    ['comida', 'Desayuno', null, '07:00'],
    ['comida', 'Almuerzo', null, '12:00'],
    ['comida', 'Cena', null, '17:30'],
    ['sesion', 'Sesión de entrenamiento (5 min)', null, '10:00'],
    ['siesta', 'Siesta de la tarde', null, '14:00'],
  ];
  for (const [kind, label, interval, time] of defaults) {
    await upsert(db, 'reminders', {
      id: randomUUID(),
      dog_id: dogId,
      kind,
      label,
      interval_min: interval,
      time_of_day: time,
      enabled: 0,
      quiet_start: interval ? DEFAULT_QUIET_START : null,
      quiet_end: interval ? DEFAULT_QUIET_END : null,
    });
  }
}

export function getReminders(db: SQLiteDatabase, dogId: string) {
  return db.getAllAsync<Reminder>(
    'SELECT * FROM reminders WHERE dog_id = ? AND deleted = 0 ORDER BY interval_min IS NULL, time_of_day, label',
    dogId,
  );
}

export type ReminderPatch = Partial<Pick<Reminder, 'label' | 'kind' | 'interval_min' | 'time_of_day' | 'enabled' | 'quiet_start' | 'quiet_end'>>;

export async function updateReminder(db: SQLiteDatabase, id: string, patch: ReminderPatch) {
  if (Object.keys(patch).length === 0) return;
  await patchRow(db, 'reminders', id, patch);
}

/** Recordatorio nuevo a hora fija (comida, siesta, sesión o una salida al baño de madrugada). */
export async function addFixedReminder(db: SQLiteDatabase, dogId: string, kind: ReminderKind, label: string, time: string) {
  const id = randomUUID();
  await upsert(db, 'reminders', { id, dog_id: dogId, kind, label, interval_min: null, time_of_day: time, enabled: 1, quiet_start: null, quiet_end: null });
  return id;
}

export async function deleteReminder(db: SQLiteDatabase, id: string) {
  await softDelete(db, 'reminders', id);
}

// ---------- Exportar / importar ----------

export type DachsiExport = {
  app: 'dachsi';
  version: number;
  exported_at: string;
} & { [T in SyncTable]?: Array<Record<string, Value>> };

/**
 * Respaldo completo en JSON. Sirve para no perder el historial al pasar de
 * Expo Go a la app propia (los datos de Expo Go no se migran solos).
 */
export async function exportAll(db: SQLiteDatabase): Promise<DachsiExport> {
  const out: DachsiExport = { app: 'dachsi', version: DATABASE_VERSION, exported_at: now() };
  for (const table of SYNC_TABLE_NAMES) {
    out[table] = await db.getAllAsync<Record<string, Value>>(`SELECT * FROM ${table} WHERE deleted = 0`);
  }
  return out;
}

/**
 * Agrega o actualiza los datos del respaldo (no borra lo que ya hay). Los respaldos
 * anteriores a la versión 4 traen ids numéricos: se traducen a UUID.
 */
export async function importAll(db: SQLiteDatabase, data: DachsiExport) {
  if (data?.app !== 'dachsi' || !Array.isArray(data.dogs)) {
    throw new Error('El archivo no es un respaldo de Dachsi.');
  }
  const legacy = (data.version ?? 1) < 4;
  const dogIds = new Map<unknown, string>();
  for (const d of data.dogs) dogIds.set(d.id, legacy ? randomUUID() : String(d.id));

  await db.withTransactionAsync(async () => {
    for (const table of SYNC_TABLE_NAMES) {
      for (const raw of data[table] ?? []) {
        const row: Record<string, Value> = {};
        for (const col of SYNC_TABLES[table]) row[col] = raw[col] ?? null;
        if (table === 'dogs') {
          row.id = dogIds.get(raw.id)!;
          row.setup_done ??= 0;
          row.created_at ??= now();
        } else {
          const dogId = dogIds.get(raw.dog_id);
          if (!dogId) continue;
          row.dog_id = dogId;
          const key = table === 'dog_goals' ? raw.goal : table === 'checklist_done' ? raw.item_id : null;
          row.id = key != null ? `${dogId}:${key}` : legacy ? randomUUID() : String(raw.id);
        }
        if (table === 'checklist_done') row.done_at ??= now();
        if (table === 'reminders' && row.interval_min) {
          row.quiet_start ??= DEFAULT_QUIET_START;
          row.quiet_end ??= DEFAULT_QUIET_END;
        }
        await upsert(db, table, row);
      }
    }
  });
}
