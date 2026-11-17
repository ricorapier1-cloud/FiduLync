-- Migration: 20261117213500_algolynx_subscription_and_account_binding.sql
-- Adds per-EA dynamic catalog, Demo vs Live entitlements, and multi-account seat binding

-- 1. Expert Advisors Catalog
CREATE TABLE IF NOT EXISTS public.expert_advisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  tier_category TEXT NOT NULL DEFAULT 'PRO',
  monthly_price_ngn NUMERIC NOT NULL DEFAULT 65000,
  monthly_price_usd NUMERIC NOT NULL DEFAULT 49,
  lifetime_price_ngn NUMERIC DEFAULT 250000,
  lifetime_price_usd NUMERIC DEFAULT 199,
  paystack_plan_code_ngn TEXT,
  max_live_accounts INT NOT NULL DEFAULT 1,
  max_demo_accounts INT NOT NULL DEFAULT 2,
  download_demo_path TEXT NOT NULL DEFAULT '/downloads/MacroLync_G10_Breakout_Test.mq5',
  download_live_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial flagship strategies if not present
INSERT INTO public.expert_advisors (slug, name, version, tier_category, monthly_price_ngn, monthly_price_usd, lifetime_price_ngn, lifetime_price_usd, download_demo_path)
VALUES
  ('eridam-nexus-pro', 'Eridam Nexus Adaptive Pro', 'v4.2', 'FLAGSHIP', 65000, 49, 250000, 199, '/downloads/Eridam_Nexus_Adaptive_Demo.mq5'),
  ('velocity-vault', 'Velocity Vault Momentum', 'v2.7', 'MOMENTUM', 45000, 35, 180000, 149, '/downloads/Velocity_Vault_Momentum_Demo.mq5'),
  ('macro-atr-breakout', 'MacroLync G10 ATR Breakout', 'v1.0 Demo', 'SANDBOX', 0, 0, 0, 0, '/downloads/MacroLync_G10_Breakout_Test.mq5')
ON CONFLICT (slug) DO NOTHING;

-- 2. Enhance licenses table
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS ea_slug TEXT DEFAULT 'eridam-nexus-pro',
  ADD COLUMN IF NOT EXISTS entitlement_type TEXT NOT NULL DEFAULT 'LIVE',
  ADD COLUMN IF NOT EXISTS max_live_slots INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_demo_slots INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS renewal_status TEXT NOT NULL DEFAULT 'ACTIVE';

-- 3. Dedicated Multi-Account Seat Binding with 72-Hour Cooldown
CREATE TABLE IF NOT EXISTS public.license_bound_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT NOT NULL REFERENCES public.licenses(license_key) ON DELETE CASCADE,
  account_number BIGINT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'LIVE' CHECK (account_type IN ('LIVE', 'DEMO')),
  broker_server TEXT,
  rebind_cooldown_until TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT license_bound_account_unique UNIQUE (license_key, account_number)
);

CREATE INDEX IF NOT EXISTS idx_bound_accounts_key ON public.license_bound_accounts(license_key);
CREATE INDEX IF NOT EXISTS idx_bound_accounts_num_type ON public.license_bound_accounts(account_number, account_type);

-- RLS Enablement
ALTER TABLE public.expert_advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_bound_accounts ENABLE ROW LEVEL SECURITY;

-- Allow public read access to catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'expert_advisors' AND policyname = 'Allow public read on expert_advisors'
  ) THEN
    CREATE POLICY "Allow public read on expert_advisors" ON public.expert_advisors FOR SELECT USING (true);
  END IF;
END $$;
