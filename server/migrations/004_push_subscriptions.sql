-- Suscripciones Web Push (una por navegador/dispositivo). No se sincronizan: viven solo en el servidor.
-- label: etiqueta de QStash para cancelar de una vez los avisos agendados de este dispositivo.
-- jobs_hash: huella de los avisos agendados, para no reagendar si no cambió nada.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint text PRIMARY KEY,
  p256dh text NOT NULL,
  auth text NOT NULL,
  label text NOT NULL UNIQUE,
  jobs_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
