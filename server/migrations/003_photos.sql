-- Fotos de la línea de tiempo. La imagen vive en Vercel Blob; aquí solo la URL y los datos.
CREATE TABLE IF NOT EXISTS photos (
  id text PRIMARY KEY,
  dog_id text NOT NULL,
  url text NOT NULL,
  taken_at text NOT NULL,
  caption text,
  level_id text, -- nivel que se celebró con esta foto, si aplica
  width integer,
  height integer,
  updated_at text NOT NULL,
  deleted integer NOT NULL DEFAULT 0,
  seq bigint NOT NULL DEFAULT nextval('sync_seq')
);
CREATE INDEX IF NOT EXISTS photos_dog_seq ON photos (dog_id, seq);
