ALTER TABLE public.escrow_deals
  ADD COLUMN IF NOT EXISTS creator_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS creator_terms_version text,
  ADD COLUMN IF NOT EXISTS buyer_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_terms_version text;
