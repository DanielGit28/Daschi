/**
 * @jest-environment node
 */
// Prueba la base de datos con SQLite real (sql.js), incluida la migración de los datos que ya hay en el teléfono.
import type { SQLiteDatabase } from 'expo-sqlite';
import initSqlJs, { type Database } from 'sql.js';
import {
  createDog,
  exportAll,
  getDogGoals,
  getDogs,
  getDoneItems,
  getPottyLogsSince,
  getReminders,
  importAll,
  migrateDbIfNeeded,
  saveDogSetup,
  setItemDone,
  type DachsiExport,
} from '../db';

jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Adaptador mínimo de sql.js a la API async de expo-sqlite. */
function adapter(sdb: Database): SQLiteDatabase {
  const all = (sql: string, params: unknown[]) => {
    const st = sdb.prepare(sql);
    st.bind(params.flat() as never);
    const rows: Record<string, unknown>[] = [];
    while (st.step()) rows.push(st.getAsObject());
    st.free();
    return rows;
  };
  return {
    execAsync: async (sql: string) => void sdb.exec(sql),
    runAsync: async (sql: string, ...params: unknown[]) => {
      sdb.run(sql, params.flat() as never);
      return { lastInsertRowId: 0, changes: sdb.getRowsModified() };
    },
    getAllAsync: async (sql: string, ...params: unknown[]) => all(sql, params),
    getFirstAsync: async (sql: string, ...params: unknown[]) => all(sql, params)[0] ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      sdb.exec('BEGIN');
      try {
        await fn();
        sdb.exec('COMMIT');
      } catch (e) {
        sdb.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as SQLiteDatabase;
}

let SQL: Awaited<ReturnType<typeof initSqlJs>>;
beforeAll(async () => {
  SQL = await initSqlJs();
});

/** Base en la versión 3 (la que hoy tiene el teléfono), con datos de ejemplo. */
function v3WithData() {
  const sdb = new SQL.Database();
  sdb.exec(`
    CREATE TABLE dogs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, breed TEXT NOT NULL, birth_date TEXT NOT NULL,
      weight_kg REAL, photo_uri TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), arrival_date TEXT, potty_spot TEXT,
      daily_minutes INTEGER, household TEXT, setup_done INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE potty_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER NOT NULL, kind TEXT NOT NULL, place TEXT NOT NULL, logged_at TEXT NOT NULL, note TEXT);
    CREATE TABLE reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL,
      interval_min INTEGER, time_of_day TEXT, enabled INTEGER NOT NULL DEFAULT 1, notification_id TEXT, quiet_start TEXT, quiet_end TEXT);
    CREATE TABLE dog_goals (dog_id INTEGER NOT NULL, goal TEXT NOT NULL, PRIMARY KEY (dog_id, goal));
    CREATE TABLE checklist_done (dog_id INTEGER NOT NULL, item_id TEXT NOT NULL, done_at TEXT NOT NULL, PRIMARY KEY (dog_id, item_id));
    CREATE TABLE session_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER NOT NULL, lesson_id TEXT NOT NULL, logged_at TEXT NOT NULL, reps INTEGER, rating INTEGER, note TEXT);
    CREATE TABLE socialization_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, dog_id INTEGER NOT NULL, item_id TEXT NOT NULL, logged_at TEXT NOT NULL, reaction TEXT NOT NULL);

    INSERT INTO dogs (name, breed, birth_date, arrival_date, potty_spot, daily_minutes, household, setup_done)
      VALUES ('Olivia', 'Dachshund (salchicha)', '2026-08-24', '2026-10-25', 'patio', 10, 'solo', 1);
    INSERT INTO potty_logs (dog_id, kind, place, logged_at) VALUES (1, 'pipi', 'fuera', '2026-10-20T15:00:00.000Z'), (1, 'popo', 'dentro', '2026-10-20T16:00:00.000Z');
    INSERT INTO reminders (dog_id, kind, label, interval_min, enabled, quiet_start, quiet_end) VALUES (1, 'bano', 'Salida al baño', 45, 1, '22:00', '06:00');
    INSERT INTO reminders (dog_id, kind, label, time_of_day, enabled) VALUES (1, 'comida', 'Desayuno', '07:00', 1);
    INSERT INTO dog_goals VALUES (1, 'caso'), (1, 'olfato');
    INSERT INTO checklist_done VALUES (1, 'prep-guacal', '2026-10-20T10:00:00.000Z');
    INSERT INTO session_logs (dog_id, lesson_id, logged_at, reps, rating) VALUES (1, 'caso-nombre', '2026-10-20T11:00:00.000Z', 8, 4);
    INSERT INTO socialization_logs (dog_id, item_id, logged_at, reaction) VALUES (1, 'soc-s-timbre', '2026-10-20T12:00:00.000Z', 'bien');
    PRAGMA user_version = 3;
  `);
  return adapter(sdb);
}

describe('migración a la versión 4', () => {
  it('conserva todos los datos de Olivia con ids UUID', async () => {
    const db = v3WithData();
    await migrateDbIfNeeded(db);

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(4);

    const [oli] = await getDogs(db);
    expect(oli.name).toBe('Olivia');
    expect(oli.id).toMatch(UUID);
    expect(oli).toMatchObject({ setup_done: 1, potty_spot: 'patio', deleted: 0, dirty: 1 });

    const logs = await getPottyLogsSince(db, oli.id, new Date('2026-10-01'));
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => UUID.test(l.id) && l.dog_id === oli.id)).toBe(true);

    const reminders = await getReminders(db, oli.id);
    expect(reminders.map((r) => r.label)).toEqual(['Salida al baño', 'Desayuno']);
    expect(reminders[0]).toMatchObject({ interval_min: 45, quiet_start: '22:00' });

    expect((await getDogGoals(db, oli.id)).sort()).toEqual(['caso', 'olfato']);
    expect(await getDoneItems(db, oli.id)).toEqual(new Set(['prep-guacal']));

    const state = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_state WHERE key = 'current_dog_id'");
    expect(state?.value).toBe(oli.id);
  });

  it('una instalación nueva llega a la versión 4 y crea mascotas', async () => {
    const db = adapter(new SQL.Database());
    await migrateDbIfNeeded(db);
    const id = await createDog(db, { name: 'Luna', breed: 'Mestiza', birth_date: '2026-09-01', weight_kg: null });
    expect(id).toMatch(UUID);
    expect((await getReminders(db, id)).length).toBe(6);
  });
});

describe('marcas sincronizables', () => {
  async function freshDog() {
    const db = adapter(new SQL.Database());
    await migrateDbIfNeeded(db);
    return { db, id: await createDog(db, { name: 'Oli', breed: 'Dachshund', birth_date: '2026-08-24', weight_kg: null }) };
  }

  it('marcar y desmarcar usa una sola fila con borrado suave', async () => {
    const { db, id } = await freshDog();
    await setItemDone(db, id, 'prep-cama', true);
    await setItemDone(db, id, 'prep-cama', false);
    await setItemDone(db, id, 'prep-cama', true);
    const rows = await db.getAllAsync<{ id: string; deleted: number }>('SELECT id, deleted FROM checklist_done');
    expect(rows).toEqual([{ id: `${id}:prep-cama`, deleted: 0 }]);
  });

  it('cambiar enfoques marca como borrados los que se quitan', async () => {
    const { db, id } = await freshDog();
    const setup = { arrival_date: '2026-10-25', potty_spot: 'patio' as const, daily_minutes: 10, household: 'solo' as const };
    await saveDogSetup(db, id, { ...setup, goals: ['caso', 'trucos'] });
    await saveDogSetup(db, id, { ...setup, goals: ['trucos', 'olfato'] });
    expect((await getDogGoals(db, id)).sort()).toEqual(['olfato', 'trucos']);
    const all = await db.getAllAsync<{ goal: string; deleted: number }>('SELECT goal, deleted FROM dog_goals ORDER BY goal');
    expect(all).toEqual([
      { goal: 'caso', deleted: 1 },
      { goal: 'olfato', deleted: 0 },
      { goal: 'trucos', deleted: 0 },
    ]);
  });
});

describe('respaldo', () => {
  it('importa un respaldo viejo (ids numéricos) traduciendo a UUID', async () => {
    const db = adapter(new SQL.Database());
    await migrateDbIfNeeded(db);
    const legacy = {
      app: 'dachsi',
      version: 3,
      exported_at: '2026-10-20T00:00:00.000Z',
      dogs: [{ id: 1, name: 'Olivia', breed: 'Dachshund', birth_date: '2026-08-24', created_at: '2026-10-19', setup_done: 1 }],
      potty_logs: [{ id: 7, dog_id: 1, kind: 'pipi', place: 'fuera', logged_at: '2026-10-20T15:00:00.000Z' }],
      dog_goals: [{ dog_id: 1, goal: 'caso' }],
    } as unknown as DachsiExport;
    await importAll(db, legacy);
    const [oli] = await getDogs(db);
    expect(oli.id).toMatch(UUID);
    expect(await getPottyLogsSince(db, oli.id, new Date('2026-10-01'))).toHaveLength(1);
    expect(await getDogGoals(db, oli.id)).toEqual(['caso']);
  });

  it('exportar e importar en otra base deja los mismos datos', async () => {
    const a = adapter(new SQL.Database());
    await migrateDbIfNeeded(a);
    const id = await createDog(a, { name: 'Oli', breed: 'Dachshund', birth_date: '2026-08-24', weight_kg: 1.8 });
    await setItemDone(a, id, 'prep-cama', true);

    const b = adapter(new SQL.Database());
    await migrateDbIfNeeded(b);
    await importAll(b, await exportAll(a));
    expect((await getDogs(b))[0]).toMatchObject({ id, name: 'Oli', weight_kg: 1.8 });
    expect(await getDoneItems(b, id)).toEqual(new Set(['prep-cama']));
    expect((await getReminders(b, id)).length).toBe(6);
  });
});
