-- A. Escrow Schema Refactor
ALTER TABLE IF EXISTS public.transactions 
  ADD COLUMN IF NOT EXISTS items_goods_description TEXT NOT NULL DEFAULT 'Unspecified',
  ADD COLUMN IF NOT EXISTS evidence_proof_of_dispatch TEXT;

-- B. Programmatic Storage Bucket Provisioning
INSERT INTO storage.buckets (id, name, public, avif_autodetection) 
VALUES ('dispute-evidence', 'dispute-evidence', false, false)
ON CONFLICT (id) DO NOTHING;

-- Storage Bucket RLS (Authenticated access only)
CREATE POLICY "Upload Dispute Evidence" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'dispute-evidence' AND 
  auth.role() = 'authenticated'
);

-- C. Vault-Isolated Row-Level Security for Trade Ledger
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own trade history" ON public.trade_history;

CREATE POLICY "Users can read own trade history" ON public.trade_history
FOR SELECT USING (
  auth.uid()::text = user_id::text 
  OR auth.uid()::text = buyer_phone 
  OR auth.uid()::text = seller_account
);
