-- Enable cryptographic extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Escrow Transactions Table
CREATE TABLE IF NOT EXISTS public.escrow_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference VARCHAR(64) UNIQUE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_phone VARCHAR(20) NOT NULL,
  seller_account VARCHAR(10) NOT NULL,
  seller_bank_code VARCHAR(10) NOT NULL,
  seller_account_name TEXT NOT NULL,
  amount_ngn NUMERIC(12, 2) NOT NULL CHECK (amount_ngn > 0),
  items_goods_description TEXT NOT NULL,
  evidence_proof_of_dispatch TEXT,
  dispute_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'funded', 'disputed', 'released', 'refunded', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Trade History Vault (Forex EA Sync Ledger)
CREATE TABLE IF NOT EXISTS public.trade_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  license_key TEXT NOT NULL,
  mt_account_number TEXT NOT NULL,
  pair VARCHAR(20) NOT NULL,
  lot_size NUMERIC(10, 2) NOT NULL,
  profit_loss NUMERIC(12, 2) NOT NULL,
  action VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. EA Licensing Authorization Matrix
CREATE TABLE IF NOT EXISTS public.ea_licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  mt_account_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Dispute Evidence Metadata Tracking
CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES public.escrow_deals(id) ON DELETE CASCADE NOT NULL,
  uploader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  proof_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- High-Performance Sub-Millisecond Indexes
CREATE INDEX IF NOT EXISTS idx_escrow_buyer_seller ON public.escrow_deals(buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_reference ON public.escrow_deals(reference);
CREATE INDEX IF NOT EXISTS idx_trade_history_user_mt ON public.trade_history(user_id, mt_account_number);
CREATE INDEX IF NOT EXISTS idx_ea_licenses_lookup ON public.ea_licenses(license_key, mt_account_number, is_active);

-- Storage Bucket Setup for Dispute Evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispute-evidence', 
  'dispute-evidence', 
  FALSE, 
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'video/mp4']
) ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- Enforce Strict Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies: Escrow Deals
CREATE POLICY "Involved parties can view escrow" ON public.escrow_deals 
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Authenticated users can create escrow" ON public.escrow_deals 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies: Trade History
CREATE POLICY "Users can view own trade history" ON public.trade_history 
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies: EA Licenses
CREATE POLICY "Users can view own EA licenses" ON public.ea_licenses 
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies: Dispute Evidence Storage Buckets
CREATE POLICY "Uploaders and Involved Parties View Proof" ON public.dispute_evidence
  FOR SELECT USING (
    uploader_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.escrow_deals 
      WHERE id = deal_id AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated Users Upload Evidence" ON public.dispute_evidence
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND uploader_id = auth.uid());
