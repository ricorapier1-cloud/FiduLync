-- A. Table Mutation: Append specific goods description & object storage URL
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS items_goods_description TEXT,
  ADD COLUMN IF NOT EXISTS evidence_proof_of_dispatch TEXT;

-- B. Storage Ingestion Bucket: Provision dispute-evidence
INSERT INTO storage.buckets (id, name, public, avif_autodetection) 
VALUES ('dispute-evidence', 'dispute-evidence', false, false)
ON CONFLICT (id) DO NOTHING;

-- C. Storage Bucket RLS: Restrict Pre-Signed URL Generation
CREATE POLICY "Authenticated users can upload dispute evidence"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispute-evidence');

CREATE POLICY "Authenticated users can read dispute evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dispute-evidence');

-- D. Vault-Isolated Row-Level Security (RLS) for Trade Logs
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own trade history" ON public.trade_history;

CREATE POLICY "Users can read own trade history" ON public.trade_history
  FOR SELECT USING (
    auth.uid()::text = user_id::text 
    OR auth.uid()::text = buyer_phone 
    OR auth.uid()::text = seller_account
  );
