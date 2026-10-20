-- Tablas sincronizadas desde la app (mismas columnas que SQLite en src/lib/sync-schema.ts).
-- updated_at: ISO 8601 del dispositivo que hizo el cambio; gana el más reciente.
-- seq: número creciente asignado por el servidor en cada cambio; los clientes piden "lo nuevo desde seq N".

CREATE SEQUENCE IF NOT EXISTS sync_seq;

CREATE TABLE IF NOT EXISTS dogs (
  id text PRIMARY KEY,
  name text NOT NULL,
  breed text NOT NULL,
  birth_date text NOT NULL,
  weight_kg double precision,
  photo_uri text,
  created_at text NOT NULL,
  arrival_date text,
  potty_spot text,
  daily_minutes integer,
  household text,
  setup_done integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS dogs_seq ON dogs (seq);

CREATE TABLE IF NOT EXISTS potty_logs (
  id text PRIMARY KEY,
  dog_id text NOT NULL,
  kind text NOT NULL,
  place text NOT NULL,
  logged_at text NOT NULL,
  note text,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS potty_logs_dog_seq ON potty_logs (dog_id, seq);

CREATE TABLE IF NOT EXISTS reminders (
  id text PRIMARY KEY,
  dog_id text NOT NULL,
  kind text NOT NULL,
  label text NOT NULL,
  interval_min integer,
  time_of_day text,
  enabled integer NOT NULL DEFAULT 1,
  quiet_start text,
  quiet_end text,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS reminders_dog_seq ON reminders (dog_id, seq);

CREATE TABLE IF NOT EXISTS dog_goals (
  id text PRIMARY KEY,
  dog_id text NOT NULL,
  goal text NOT NULL,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS dog_goals_dog_seq ON dog_goals (dog_id, seq);

CREATE TABLE IF NOT EXISTS checklist_done (
  id text PRIMARY KEY,
  dog_id text NOT NULL,
  item_id text NOT NULL,
  done_at text NOT NULL,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS checklist_done_dog_seq ON checklist_done (dog_id, seq);

CREATE TABLE IF NOT EXISTS session_logs (
  id text PRIMARY KEY,
  dog_id text NOT NULL,
  lesson_id text NOT NULL,
  logged_at text NOT NULL,
  reps integer,
  rating integer,
  note text,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS session_logs_dog_seq ON session_logs (dog_id, seq);

CREATE TABLE IF NOT EXISTS socialization_logs (
  id text PRIMARY KEY,
  dog_id text NOT NULL,
  item_id text NOT NULL,
  logged_at text NOT NULL,
  reaction text NOT NULL,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS socialization_logs_dog_seq ON socialization_logs (dog_id, seq);
