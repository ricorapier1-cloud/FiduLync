ALTER TABLE public.escrow_deals
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_escrow_deals_created_by_created_at
  ON public.escrow_deals(created_by, created_at DESC)
  WHERE created_by IS NOT NULL;
