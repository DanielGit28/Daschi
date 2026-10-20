// Solo para tests: SQLite real (sql.js) detrás de la API async de expo-sqlite.
import type { SQLiteDatabase } from 'expo-sqlite';
import initSqlJs, { type Database } from 'sql.js';
import { migrateDbIfNeeded } from '../lib/db';

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

export async function newSqlJsDatabase() {
  SQL ??= await initSqlJs();
  return new SQL.Database();
}

export function sqljsAdapter(sdb: Database): SQLiteDatabase {
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

/** Base nueva ya migrada a la última versión. */
export async function newAppDatabase() {
  const db = sqljsAdapter(await newSqlJsDatabase());
  await migrateDbIfNeeded(db);
  return db;
}
