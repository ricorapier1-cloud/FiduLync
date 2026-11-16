-- Customer portal reads the latest heartbeat timestamp; keep it explicit and upsert-safe.
ALTER TABLE public.ea_heartbeats
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.ea_heartbeats
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;
