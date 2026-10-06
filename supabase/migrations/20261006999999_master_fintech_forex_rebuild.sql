-- A. Escrow Schema Enhancements
ALTER TABLE IF EXISTS public.transactions 
  ADD COLUMN IF NOT EXISTS items_goods_description TEXT NOT NULL DEFAULT 'Unspecified',
  ADD COLUMN IF NOT EXISTS evidence_proof_of_dispatch TEXT,
  ADD COLUMN IF NOT EXISTS dispute_evidence_url TEXT;

-- B. Forex EA Licenses & Trade Ledger (For MetaTrader Webhooks)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    license_key TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trade_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    seller_account TEXT,
    buyer_phone TEXT,
    pair TEXT,
    lot_size NUMERIC,
    profit_loss NUMERIC,
    action TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- C. Dispute Evidence Storage Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'dispute-evidence', 
  'dispute-evidence', 
  false, 
  52428800, -- 50MB limit for image/video proof
  ARRAY['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']
) ON CONFLICT (id) DO NOTHING;

-- D. Absolute Row-Level Security (RLS)
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own trade history" ON public.trade_history;
CREATE POLICY "Users can read own trade history" ON public.trade_history
FOR SELECT USING (
  auth.uid()::text = user_id::text 
  OR auth.uid()::text = buyer_phone 
  OR auth.uid()::text = seller_account
);

DROP POLICY IF EXISTS "Upload Dispute Evidence" ON storage.objects;
CREATE POLICY "Upload Dispute Evidence" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'dispute-evidence' AND auth.role() = 'authenticated');
