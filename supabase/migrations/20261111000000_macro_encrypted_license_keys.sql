ALTER TABLE public.macro_api_keys
  ADD COLUMN IF NOT EXISTS encrypted_key text;
