import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'dachsi.db';

export type Dog = {
  id: number;
  name: string;
  breed: string;
  birth_date: string; // AAAA-MM-DD
  weight_kg: number | null;
  photo_uri: string | null;
  created_at: string;
};

export type PottyKind = 'pipi' | 'popo';
export type PottyPlace = 'fuera' | 'dentro';

export type PottyLog = {
  id: number;
  dog_id: number;
  kind: PottyKind;
  place: PottyPlace;
  logged_at: string; // ISO
  note: string | null;
};

export type ReminderKind = 'bano' | 'comida' | 'siesta' | 'sesion';

export type Reminder = {
  id: number;
  dog_id: number;
  kind: ReminderKind;
  label: string;
  // Si interval_min tiene valor, se repite cada N minutos; si no, a la hora fija time_of_day (HH:MM).
  interval_min: number | null;
  time_of_day: string | null;
  enabled: number; // 0 | 1
  notification_id: string | null;
  // Silencio de noche (HH:MM) para los recordatorios por intervalo.
  quiet_start: string | null;
  quiet_end: string | null;
};

export const DEFAULT_QUIET_START = '22:00';
export const DEFAULT_QUIET_END = '06:00';

const DATABASE_VERSION = 2;

/**
 * Migraciones con PRAGMA user_version: cada versión nueva agrega un bloque
 * `if (current < N)` sin tocar los anteriores, así los datos de la cachorra
 * sobreviven a cada actualización de la app.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // foreign_keys vale solo para la conexión actual: hay que activarlo en cada arranque.
  await db.execAsync('PRAGMA foreign_keys = ON');
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

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

// ---------- Perros ----------

export function getDog(db: SQLiteDatabase) {
  return db.getFirstAsync<Dog>('SELECT * FROM dogs ORDER BY id LIMIT 1');
}

export type DogInput = {
  name: string;
  breed: string;
  birth_date: string;
  weight_kg: number | null;
};

export async function createDog(db: SQLiteDatabase, input: DogInput) {
  const result = await db.runAsync(
    'INSERT INTO dogs (name, breed, birth_date, weight_kg) VALUES (?, ?, ?, ?)',
    input.name,
    input.breed,
    input.birth_date,
    input.weight_kg,
  );
  await seedDefaultReminders(db, result.lastInsertRowId);
  return result.lastInsertRowId;
}

export async function updateDog(db: SQLiteDatabase, id: number, input: DogInput) {
  await db.runAsync(
    'UPDATE dogs SET name = ?, breed = ?, birth_date = ?, weight_kg = ? WHERE id = ?',
    input.name,
    input.breed,
    input.birth_date,
    input.weight_kg,
    id,
  );
}

// ---------- Registros de baño ----------

export async function addPottyLog(
  db: SQLiteDatabase,
  dogId: number,
  kind: PottyKind,
  place: PottyPlace,
  at: Date = new Date(),
) {
  const result = await db.runAsync(
    'INSERT INTO potty_logs (dog_id, kind, place, logged_at) VALUES (?, ?, ?, ?)',
    dogId,
    kind,
    place,
    at.toISOString(),
  );
  return result.lastInsertRowId;
}

export function getPottyLogsSince(db: SQLiteDatabase, dogId: number, since: Date) {
  return db.getAllAsync<PottyLog>(
    'SELECT * FROM potty_logs WHERE dog_id = ? AND logged_at >= ? ORDER BY logged_at DESC',
    dogId,
    since.toISOString(),
  );
}

export async function deletePottyLog(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM potty_logs WHERE id = ?', id);
}

/** Último registro de baño (pipí o popó, dentro o fuera): desde ahí se cuenta la próxima salida. */
export function getLastPottyLog(db: SQLiteDatabase, dogId: number) {
  return db.getFirstAsync<PottyLog>('SELECT * FROM potty_logs WHERE dog_id = ? ORDER BY logged_at DESC LIMIT 1', dogId);
}

// ---------- Recordatorios ----------

/** Recordatorios por defecto para un cachorro de ~8 semanas; empiezan apagados. */
async function seedDefaultReminders(db: SQLiteDatabase, dogId: number) {
  const defaults: Array<[ReminderKind, string, number | null, string | null]> = [
    ['bano', 'Salida al baño', 60, null],
    ['comida', 'Desayuno', null, '07:00'],
    ['comida', 'Almuerzo', null, '12:00'],
    ['comida', 'Cena', null, '17:30'],
    ['sesion', 'Sesión de entrenamiento (5 min)', null, '10:00'],
    ['siesta', 'Siesta de la tarde', null, '14:00'],
  ];
  for (const [kind, label, interval, time] of defaults) {
    await db.runAsync(
      'INSERT INTO reminders (dog_id, kind, label, interval_min, time_of_day, enabled, quiet_start, quiet_end) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      dogId,
      kind,
      label,
      interval,
      time,
      interval ? DEFAULT_QUIET_START : null,
      interval ? DEFAULT_QUIET_END : null,
    );
  }
}

export function getReminders(db: SQLiteDatabase, dogId: number) {
  return db.getAllAsync<Reminder>(
    'SELECT * FROM reminders WHERE dog_id = ? ORDER BY interval_min IS NULL, time_of_day, id',
    dogId,
  );
}

export type ReminderPatch = Partial<Pick<Reminder, 'label' | 'kind' | 'interval_min' | 'time_of_day' | 'enabled' | 'quiet_start' | 'quiet_end'>>;

export async function updateReminder(db: SQLiteDatabase, id: number, patch: ReminderPatch) {
  const keys = Object.keys(patch) as Array<keyof ReminderPatch>;
  if (keys.length === 0) return;
  await db.runAsync(
    `UPDATE reminders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map((k) => patch[k] ?? null),
    id,
  );
}

/** Recordatorio nuevo a hora fija (comida, siesta, sesión o una salida al baño de madrugada). */
export async function addFixedReminder(db: SQLiteDatabase, dogId: number, kind: ReminderKind, label: string, time: string) {
  const result = await db.runAsync(
    'INSERT INTO reminders (dog_id, kind, label, time_of_day, enabled) VALUES (?, ?, ?, ?, 1)',
    dogId,
    kind,
    label,
    time,
  );
  return result.lastInsertRowId;
}

export async function deleteReminder(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM reminders WHERE id = ?', id);
}

// ---------- Exportar / importar ----------

export type DachsiExport = {
  app: 'dachsi';
  version: number;
  exported_at: string;
  dogs: Dog[];
  potty_logs: PottyLog[];
  reminders: Reminder[];
};

/**
 * Respaldo completo en JSON. Sirve para no perder el historial al pasar de
 * Expo Go a la app propia (los datos de Expo Go no se migran solos).
 */
export async function exportAll(db: SQLiteDatabase): Promise<DachsiExport> {
  const [dogs, potty_logs, reminders] = await Promise.all([
    db.getAllAsync<Dog>('SELECT * FROM dogs'),
    db.getAllAsync<PottyLog>('SELECT * FROM potty_logs ORDER BY logged_at'),
    db.getAllAsync<Reminder>('SELECT * FROM reminders'),
  ]);
  return {
    app: 'dachsi',
    version: DATABASE_VERSION,
    exported_at: new Date().toISOString(),
    dogs,
    potty_logs,
    reminders: reminders.map((r) => ({ ...r, notification_id: null })),
  };
}

/** Reemplaza todos los datos locales por los del respaldo. */
export async function importAll(db: SQLiteDatabase, data: DachsiExport) {
  if (data?.app !== 'dachsi' || !Array.isArray(data.dogs)) {
    throw new Error('El archivo no es un respaldo de Dachsi.');
  }
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM potty_logs; DELETE FROM reminders; DELETE FROM dogs;');
    for (const d of data.dogs) {
      await db.runAsync(
        'INSERT INTO dogs (id, name, breed, birth_date, weight_kg, photo_uri, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        d.id, d.name, d.breed, d.birth_date, d.weight_kg, d.photo_uri, d.created_at,
      );
    }
    for (const p of data.potty_logs ?? []) {
      await db.runAsync(
        'INSERT INTO potty_logs (id, dog_id, kind, place, logged_at, note) VALUES (?, ?, ?, ?, ?, ?)',
        p.id, p.dog_id, p.kind, p.place, p.logged_at, p.note,
      );
    }
    for (const r of data.reminders ?? []) {
      await db.runAsync(
        'INSERT INTO reminders (id, dog_id, kind, label, interval_min, time_of_day, enabled, quiet_start, quiet_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        r.id, r.dog_id, r.kind, r.label, r.interval_min, r.time_of_day, r.enabled,
        // Los respaldos de la versión 1 no traen silencio de noche.
        r.quiet_start ?? (r.interval_min ? DEFAULT_QUIET_START : null),
        r.quiet_end ?? (r.interval_min ? DEFAULT_QUIET_END : null),
      );
    }
  });
}
