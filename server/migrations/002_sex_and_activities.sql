-- Sexo de la mascota (para adaptar los textos) y registros de comida y siesta.
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS sex text;

CREATE TABLE IF NOT EXISTS activity_logs (
  id text PRIMARY KEY,
  dog_id text NOT NULL,
  kind text NOT NULL, -- 'comida' | 'dormir' | 'despertar'
  logged_at text NOT NULL,
  note text,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS activity_logs_dog_seq ON activity_logs (dog_id, seq);
