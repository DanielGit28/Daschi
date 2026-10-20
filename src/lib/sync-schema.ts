// Tablas que se sincronizan entre dispositivos y el servidor. Lo comparten la app (SQLite) y la API (Postgres).

/** Columnas de datos de cada tabla (sin los campos de sincronización), con las tablas padre primero. */
export const SYNC_TABLES = {
  dogs: ['id', 'name', 'breed', 'birth_date', 'weight_kg', 'photo_uri', 'created_at', 'arrival_date', 'potty_spot', 'daily_minutes', 'household', 'setup_done', 'sex'],
  potty_logs: ['id', 'dog_id', 'kind', 'place', 'logged_at', 'note'],
  reminders: ['id', 'dog_id', 'kind', 'label', 'interval_min', 'time_of_day', 'enabled', 'quiet_start', 'quiet_end'],
  dog_goals: ['id', 'dog_id', 'goal'],
  checklist_done: ['id', 'dog_id', 'item_id', 'done_at'],
  session_logs: ['id', 'dog_id', 'lesson_id', 'logged_at', 'reps', 'rating', 'note'],
  socialization_logs: ['id', 'dog_id', 'item_id', 'logged_at', 'reaction'],
  activity_logs: ['id', 'dog_id', 'kind', 'logged_at', 'note'],
} as const;

export type SyncTable = keyof typeof SYNC_TABLES;
export const SYNC_TABLE_NAMES = Object.keys(SYNC_TABLES) as SyncTable[];

export type SyncValue = string | number | null;
/** Fila tal como viaja: columnas de datos + updated_at + deleted. */
export type SyncRow = Record<string, SyncValue>;
export type SyncChanges = Partial<Record<SyncTable, SyncRow[]>>;

/** Una mascota por pedido: sube sus cambios y baja lo nuevo desde `cursor`. */
export type SyncRequest = { dogId: string; cursor: number; changes: SyncChanges };
export type SyncResponse = { cursor: number; changes: SyncChanges };

/** Perfil público para elegir mascota en otro dispositivo. */
export type PublicDog = { id: string; name: string; breed: string; birth_date: string };

/** Columnas que viajan para cada tabla. */
export function wireColumns(table: SyncTable): string[] {
  return [...SYNC_TABLES[table], 'updated_at', 'deleted'];
}
