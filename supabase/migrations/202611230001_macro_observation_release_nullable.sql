-- Provider release timestamps are not available for every official observation.
-- NULL means unknown; retrieval time is recorded separately in retrieved_at.
ALTER TABLE public.macro_observations
  ALTER COLUMN released_at DROP NOT NULL;
