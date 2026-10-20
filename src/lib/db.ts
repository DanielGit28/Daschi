import type { SQLiteDatabase } from 'expo-sqlite';
import type { GoalId, Household, PottySpot } from '../content';

export const DATABASE_NAME = 'dachsi.db';

export type Dog = {
  id: number;
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

const DATABASE_VERSION = 3;

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

      -- Lista de preparación, lecciones logradas y guías leídas.
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
      CREATE INDEX IF NOT EXISTS idx_session_dog_lesson ON session_logs(dog_id, lesson_id, logged_at);

      CREATE TABLE IF NOT EXISTS socialization_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        logged_at TEXT NOT NULL,
        reaction TEXT NOT NULL CHECK (reaction IN ('bien','dudosa','miedo'))
      );
      CREATE INDEX IF NOT EXISTS idx_social_dog ON socialization_logs(dog_id, item_id);
    `);
    current = 3;
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

export type DogSetup = {
  arrival_date: string;
  potty_spot: PottySpot;
  daily_minutes: number;
  household: Household;
  goals: GoalId[];
};

/** Respuestas de las preguntas de enfoques. */
export async function saveDogSetup(db: SQLiteDatabase, dogId: number, setup: DogSetup) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE dogs SET arrival_date = ?, potty_spot = ?, daily_minutes = ?, household = ?, setup_done = 1 WHERE id = ?',
      setup.arrival_date,
      setup.potty_spot,
      setup.daily_minutes,
      setup.household,
      dogId,
    );
    await db.runAsync('DELETE FROM dog_goals WHERE dog_id = ?', dogId);
    for (const goal of setup.goals) {
      await db.runAsync('INSERT INTO dog_goals (dog_id, goal) VALUES (?, ?)', dogId, goal);
    }
  });
}

export async function getDogGoals(db: SQLiteDatabase, dogId: number): Promise<GoalId[]> {
  const rows = await db.getAllAsync<{ goal: GoalId }>('SELECT goal FROM dog_goals WHERE dog_id = ?', dogId);
  return rows.map((r) => r.goal);
}

// ---------- Listas y progreso ----------

export async function getDoneItems(db: SQLiteDatabase, dogId: number) {
  const rows = await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM checklist_done WHERE dog_id = ?', dogId);
  return new Set(rows.map((r) => r.item_id));
}

export async function setItemDone(db: SQLiteDatabase, dogId: number, itemId: string, done: boolean) {
  if (done) {
    await db.runAsync(
      'INSERT OR IGNORE INTO checklist_done (dog_id, item_id, done_at) VALUES (?, ?, ?)',
      dogId,
      itemId,
      new Date().toISOString(),
    );
  } else {
    await db.runAsync('DELETE FROM checklist_done WHERE dog_id = ? AND item_id = ?', dogId, itemId);
  }
}

export type SessionLog = {
  id: number;
  dog_id: number;
  lesson_id: string;
  logged_at: string;
  reps: number | null;
  rating: number | null;
  note: string | null;
};

export async function addSessionLog(db: SQLiteDatabase, dogId: number, lessonId: string, reps: number | null, rating: number | null) {
  await db.runAsync(
    'INSERT INTO session_logs (dog_id, lesson_id, logged_at, reps, rating) VALUES (?, ?, ?, ?, ?)',
    dogId,
    lessonId,
    new Date().toISOString(),
    reps,
    rating,
  );
}

export function getSessionLogs(db: SQLiteDatabase, dogId: number, lessonId: string) {
  return db.getAllAsync<SessionLog>(
    'SELECT * FROM session_logs WHERE dog_id = ? AND lesson_id = ? ORDER BY logged_at DESC',
    dogId,
    lessonId,
  );
}

/** Última práctica de cada lección, en ms (para el motor del plan). */
export async function getLastPracticed(db: SQLiteDatabase, dogId: number) {
  const rows = await db.getAllAsync<{ lesson_id: string; last: string }>(
    'SELECT lesson_id, MAX(logged_at) AS last FROM session_logs WHERE dog_id = ? GROUP BY lesson_id',
    dogId,
  );
  return new Map(rows.map((r) => [r.lesson_id, new Date(r.last).getTime()]));
}

export type Reaction = 'bien' | 'dudosa' | 'miedo';

export type SocializationLog = {
  id: number;
  dog_id: number;
  item_id: string;
  logged_at: string;
  reaction: Reaction;
};

export async function addSocializationLog(db: SQLiteDatabase, dogId: number, itemId: string, reaction: Reaction) {
  await db.runAsync(
    'INSERT INTO socialization_logs (dog_id, item_id, logged_at, reaction) VALUES (?, ?, ?, ?)',
    dogId,
    itemId,
    new Date().toISOString(),
    reaction,
  );
}

export function getSocializationLogs(db: SQLiteDatabase, dogId: number) {
  return db.getAllAsync<SocializationLog>('SELECT * FROM socialization_logs WHERE dog_id = ? ORDER BY logged_at DESC', dogId);
}

export async function deleteSocializationLog(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM socialization_logs WHERE id = ?', id);
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
  // Desde la versión 3.
  dog_goals?: Array<{ dog_id: number; goal: string }>;
  checklist_done?: Array<{ dog_id: number; item_id: string; done_at: string }>;
  session_logs?: SessionLog[];
  socialization_logs?: SocializationLog[];
};

/** Columnas que se respaldan de cada tabla, con las tablas padre primero. */
const BACKUP_TABLES = {
  dogs: ['id', 'name', 'breed', 'birth_date', 'weight_kg', 'photo_uri', 'created_at', 'arrival_date', 'potty_spot', 'daily_minutes', 'household', 'setup_done'],
  potty_logs: ['id', 'dog_id', 'kind', 'place', 'logged_at', 'note'],
  reminders: ['id', 'dog_id', 'kind', 'label', 'interval_min', 'time_of_day', 'enabled', 'quiet_start', 'quiet_end'],
  dog_goals: ['dog_id', 'goal'],
  checklist_done: ['dog_id', 'item_id', 'done_at'],
  session_logs: ['id', 'dog_id', 'lesson_id', 'logged_at', 'reps', 'rating', 'note'],
  socialization_logs: ['id', 'dog_id', 'item_id', 'logged_at', 'reaction'],
} as const;

type BackupTable = keyof typeof BACKUP_TABLES;

/**
 * Respaldo completo en JSON. Sirve para no perder el historial al pasar de
 * Expo Go a la app propia (los datos de Expo Go no se migran solos).
 */
export async function exportAll(db: SQLiteDatabase): Promise<DachsiExport> {
  const [dogs, potty_logs, reminders, dog_goals, checklist_done, session_logs, socialization_logs] = await Promise.all([
    db.getAllAsync<Dog>('SELECT * FROM dogs'),
    db.getAllAsync<PottyLog>('SELECT * FROM potty_logs ORDER BY logged_at'),
    db.getAllAsync<Reminder>('SELECT * FROM reminders'),
    db.getAllAsync<{ dog_id: number; goal: string }>('SELECT * FROM dog_goals'),
    db.getAllAsync<{ dog_id: number; item_id: string; done_at: string }>('SELECT * FROM checklist_done'),
    db.getAllAsync<SessionLog>('SELECT * FROM session_logs ORDER BY logged_at'),
    db.getAllAsync<SocializationLog>('SELECT * FROM socialization_logs ORDER BY logged_at'),
  ]);
  return {
    app: 'dachsi',
    version: DATABASE_VERSION,
    exported_at: new Date().toISOString(),
    dogs,
    potty_logs,
    reminders: reminders.map((r) => ({ ...r, notification_id: null })),
    dog_goals,
    checklist_done,
    session_logs,
    socialization_logs,
  };
}

/** Reemplaza todos los datos locales por los del respaldo. */
export async function importAll(db: SQLiteDatabase, data: DachsiExport) {
  if (data?.app !== 'dachsi' || !Array.isArray(data.dogs)) {
    throw new Error('El archivo no es un respaldo de Dachsi.');
  }
  // Los respaldos viejos no traen las columnas ni tablas nuevas: se completan con valores por defecto.
  const rows: Record<BackupTable, ReadonlyArray<Record<string, unknown>>> = {
    dogs: data.dogs.map((d) => ({ ...d, setup_done: d.setup_done ?? 0 })),
    potty_logs: data.potty_logs ?? [],
    reminders: (data.reminders ?? []).map((r) => ({
      ...r,
      quiet_start: r.quiet_start ?? (r.interval_min ? DEFAULT_QUIET_START : null),
      quiet_end: r.quiet_end ?? (r.interval_min ? DEFAULT_QUIET_END : null),
    })),
    dog_goals: data.dog_goals ?? [],
    checklist_done: data.checklist_done ?? [],
    session_logs: data.session_logs ?? [],
    socialization_logs: data.socialization_logs ?? [],
  };
  const tables = Object.keys(BACKUP_TABLES) as BackupTable[];

  await db.withTransactionAsync(async () => {
    // Hijos primero al borrar, padres primero al insertar.
    for (const table of [...tables].reverse()) await db.runAsync(`DELETE FROM ${table}`);
    for (const table of tables) {
      const columns = BACKUP_TABLES[table];
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
      for (const row of rows[table]) {
        await db.runAsync(sql, ...columns.map((c) => (row[c] ?? null) as string | number | null));
      }
    }
  });
}
